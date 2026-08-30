import { PrivateKey, PublicKey } from 'symbol-sdk';
import {
  SymbolFacade, descriptors, models, Address as SymbolAddressType, SymbolTransactionFactory,
} from 'symbol-sdk/symbol';
import { getNetworkMode } from './chains';

// See lib/symbolAccount.ts for why this is needed - both files touch symbol-sdk's
// ed25519 code (this one via account.signTransaction), and this is a global (not
// per-module) runtime switch, so it's safe/cheap to set from either entry point.
if (typeof process !== 'undefined' && process.env) {
  process.env.SYMBOL_SDK_NO_WASM = '1';
}

/**
 * Symbol integration: balance/transaction reads and transfer sending, via a public REST
 * gateway. Mirrors the fallback-list pattern lib/chains.ts uses for EVM RPC endpoints (see
 * withRpcFallback there) - public Symbol nodes are shared, unauthenticated community
 * infrastructure that go offline without notice, so reads/writes retry across a short list
 * of currently-healthy HTTPS nodes rather than depending on any single one.
 *
 * Mainnet vs testnet (see 設定 > テストネットモード / lib/chains.ts's NetworkMode, the single
 * source of truth this reads via getNetworkMode()) mirrors the same mutually-exclusive
 * split lib/chains.ts uses for the EVM chains - see getNodeUrls/symbolNetworkName below.
 */

const MAINNET_NODE_URLS = [
  'https://symbol.nagoya:3001',
  'https://ahra-symbol.com:3001',
  'https://sn1.msus-symbol.com:3001',
  'https://xym.jp1.node.leywapool.com:3001',
  'https://00.harvester.earth:3001',
  'https://node.exymlab.com:3001',
  'https://0.xym.stakeme.tokyo:3001',
  'https://age01.kitsutsuki.tokyo:3001',
  'https://xym.allnodes.me:3001',
];

// From https://symbolnodes.org/nodes_testnet/ (peer/api nodes currently up and advertising
// an HTTPS/3001 listener).
const TESTNET_NODE_URLS = [
  'https://001-sai-dual.symboltest.net:3001',
  'https://201-sai-dual.symboltest.net:3001',
  'https://401-sai-dual.symboltest.net:3001',
  'https://2.dusanjp.com:3001',
  'https://testnet1.symbol-mikun.net:3001',
  'https://testnet2.symbol-mikun.net:3001',
  'https://sym-test-01.opening-line.jp:3001',
  'https://sym-test-03.opening-line.jp:3001',
  'https://t.sakia.harvestasya.com:3001',
];

// Exported (not just module-local) so lib/symbolHarvest.ts can reuse the same
// known-reachable/CORS-enabled node list, fallback strategy and small helpers instead of
// duplicating them - harvesting setup needs to call additional REST endpoints (/node/info,
// /node/peers, /node/unlockedaccount) against these same nodes.
export function getNodeUrls(): string[] {
  return getNetworkMode() === 'debug' ? TESTNET_NODE_URLS : MAINNET_NODE_URLS;
}

// symbol-sdk's SymbolFacade network name for whichever network is currently active -
// 'debug' (this app's toggle) maps to symbol-sdk's 'testnet' network identifier.
export function symbolNetworkName(): 'mainnet' | 'testnet' {
  return getNetworkMode() === 'debug' ? 'testnet' : 'mainnet';
}

// symbol.xym - Symbol's native currency mosaic. Mainnet-wide constant, never changes.
// Source: https://docs.symbol.dev/concepts/mosaic.html
export const XYM_MOSAIC_ID = '6BED913FA20223F8';
export const XYM_DIVISIBILITY = 6;

/**
 * Current JPY price of XYM, for the small "≈ n JPY" line under the balance - best-effort,
 * same as the EVM chains' fetchNativeJpyRate in lib/chains.ts, but kept separate here
 * since that one is keyed to lib/chains.ts's EVM chain registry and CoinGecko id list,
 * which Symbol isn't part of.
 */
let cachedJpyRate: number | undefined;

export async function fetchSymbolJpyRate(): Promise<number> {
  if (cachedJpyRate !== undefined) {
    return cachedJpyRate;
  }
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=symbol&vs_currencies=jpy');
    const json = await response.json();
    const rate = Number(json?.symbol?.jpy ?? 0);
    cachedJpyRate = rate;
    return rate;
  } catch (e) {
    console.error('Failed to fetch XYM/JPY rate', e);
    return 0;
  }
}

let cachedNodeUrl: string | null = null;
// Tracks which mode cachedNodeUrl was found under, so a debug-mode toggle doesn't try to
// reuse a cached mainnet (or testnet) node URL that isn't even in the other mode's list -
// mirrors lib/chains.ts's setNetworkMode clearing its own providerCache on a mode switch.
let cachedNodeUrlMode: ReturnType<typeof getNetworkMode> | null = null;

export async function withNodeFallback<T>(call: (nodeUrl: string) => Promise<T>): Promise<T> {
  const mode = getNetworkMode();
  if (cachedNodeUrlMode !== null && cachedNodeUrlMode !== mode) {
    cachedNodeUrl = null;
  }
  const allUrls = getNodeUrls();
  const urls = cachedNodeUrl ? [cachedNodeUrl, ...allUrls.filter((u) => u !== cachedNodeUrl)] : allUrls;
  let lastError: unknown;
  for (const url of urls) {
    try {
      const result = await call(url);
      cachedNodeUrl = url;
      cachedNodeUrlMode = mode;
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Symbol REST call failed via ${url}, trying next node`, error);
    }
  }
  throw lastError;
}

export async function fetchJson(nodeUrl: string, path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const response = await fetch(`${nodeUrl}${path}`, init);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Symbol REST ${path} failed with status ${response.status}`);
  }
  return { status: response.status, body: await response.json() };
}

export function microToDisplay(amount: string | number | bigint, divisibility: number = XYM_DIVISIBILITY): string {
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(divisibility);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(divisibility, '0').replace(/0+$/, '');
  const text = fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

/**
 * Fetches the XYM balance for a Symbol address. A brand new address that has never
 * received anything doesn't exist on chain yet - the node returns 404, which is treated
 * as a zero balance rather than an error.
 */
export async function fetchSymbolBalance(address: string): Promise<string> {
  return withNodeFallback(async (nodeUrl) => {
    const { status, body } = await fetchJson(nodeUrl, `/accounts/${address}`);
    if (status === 404) {
      return '0';
    }
    const mosaics: Array<{ id: string; amount: string }> = body?.account?.mosaics ?? [];
    const xym = mosaics.find((m) => m.id.toUpperCase() === XYM_MOSAIC_ID);
    return xym ? microToDisplay(xym.amount) : '0';
  });
}

export interface SymbolTransactionSummary {
  hash: string;
  direction: 'in' | 'out';
  counterparty: string;
  amount: string; // XYM, '' if this transfer carried no XYM (mosaic-only/message-only edge case)
  message: string;
  timestamp: number; // epoch ms, 0 if unavailable
  height: string;
}

// Symbol's network epoch (block height 1 / the network's launch instant), used to convert
// a transaction's network timestamp (ms since this epoch) into a normal epoch-ms Date.
// Testnet's epoch is a different instant from mainnet's (it was relaunched in 2022), not
// just a different network identifier byte, so this has to follow symbolNetworkName() the
// same way the node list and facade do. Source: symbol-sdk's Network.NETWORKS mainnet/
// testnet definitions (epochTime).
const MAINNET_EPOCH_MS = Date.UTC(2021, 2, 16, 0, 6, 25);
const TESTNET_EPOCH_MS = Date.UTC(2022, 9, 31, 21, 7, 47);

function toEpochMs(networkTimestamp: string | number | undefined): number {
  if (networkTimestamp == null) return 0;
  const epoch = symbolNetworkName() === 'testnet' ? TESTNET_EPOCH_MS : MAINNET_EPOCH_MS;
  return epoch + Number(networkTimestamp);
}

// REST returns recipientAddress as hex-encoded raw bytes in transaction JSON (not the
// human base32 form) - decode via symbol-sdk's Address type rather than hand-rolling base32.
function decodeAddressHex(hex: string): string {
  try {
    return new SymbolAddressType(Uint8Array.from(Buffer.from(hex, 'hex'))).toString();
  } catch {
    return '';
  }
}

// The REST transaction JSON only ever carries the signer's *public key*, never a signer
// address field - the sender's address for an incoming transfer is derived from it here
// via the mainnet facade, the same way symbol-sdk itself computes SymbolPublicAccount.address.
function addressFromPublicKeyHex(publicKeyHex: string): string {
  try {
    const facade = new SymbolFacade(symbolNetworkName());
    return facade.network.publicKeyToAddress(new PublicKey(publicKeyHex)).toString();
  } catch {
    return '';
  }
}

function summarizeTransferTx(tx: any, selfAddress: string): SymbolTransactionSummary | null {
  const content = tx.transaction;
  if (content?.type !== 16724) return null; // 16724 = transfer transaction
  const meta = tx.meta ?? {};
  const recipient = content.recipientAddress ? decodeAddressHex(content.recipientAddress) : '';
  const isOutgoing = recipient !== selfAddress;
  const mosaics: Array<{ id: string; amount: string }> = content.mosaics ?? [];
  const xym = mosaics.find((m) => m.id.toUpperCase() === XYM_MOSAIC_ID);
  let message = '';
  if (content.message) {
    // First byte is the message type (0 = plain, 1 = encrypted) - drop it before decoding.
    const hex: string = content.message;
    const bodyHex = hex.slice(2);
    try {
      message = hex.startsWith('00') ? Buffer.from(bodyHex, 'hex').toString('utf8') : '(Encrypted message)';
    } catch {
      message = '';
    }
  }
  return {
    hash: meta.hash ?? '',
    direction: isOutgoing ? 'out' : 'in',
    counterparty: isOutgoing ? recipient : addressFromPublicKeyHex(content.signerPublicKey ?? ''),
    amount: xym ? microToDisplay(xym.amount) : '',
    message,
    timestamp: toEpochMs(meta.timestamp),
    height: meta.height ?? '',
  };
}

/**
 * Fetches the most recent confirmed transfer transactions involving this address (both
 * sent and received), newest first.
 */
export async function fetchSymbolTransactions(address: string, pageSize: number = 25): Promise<SymbolTransactionSummary[]> {
  return withNodeFallback(async (nodeUrl) => {
    const { body } = await fetchJson(
      nodeUrl,
      `/transactions/confirmed?address=${address}&pageSize=${pageSize}&order=desc&type=16724`,
    );
    const data: any[] = body?.data ?? [];
    return data
      .map((tx) => summarizeTransferTx(tx, address))
      .filter((tx): tx is SymbolTransactionSummary => tx !== null);
  });
}

/**
 * Current network fee multiplier, used to price a transaction's fee at (transaction size
 * in bytes) x (multiplier). Falls back to a small fixed multiplier if the node's fee
 * endpoint is unavailable, which still produces a valid (if possibly slow-to-confirm)
 * transaction rather than blocking the send.
 */
export async function fetchFeeMultiplier(): Promise<number> {
  try {
    return await withNodeFallback(async (nodeUrl) => {
      const { body } = await fetchJson(nodeUrl, '/network/fees/transaction');
      return Number(body?.medianFeeMultiplier ?? body?.averageFeeMultiplier ?? 100);
    });
  } catch {
    return 100;
  }
}

function buildTransferDescriptor(recipientAddress: string, amountXym: string, message: string) {
  const amountMicro = BigInt(Math.round(Number(amountXym) * 10 ** XYM_DIVISIBILITY));
  const recipient = new SymbolAddressType(recipientAddress);
  const mosaics = [
    new descriptors.UnresolvedMosaicDescriptor(
      new models.UnresolvedMosaicId(BigInt(`0x${XYM_MOSAIC_ID}`)),
      new models.Amount(amountMicro),
    ),
  ];
  const messageBytes = message.length > 0 ? new Uint8Array([0, ...new TextEncoder().encode(message)]) : undefined;
  return new descriptors.TransferTransactionV1Descriptor(recipient, mosaics, messageBytes);
}

/**
 * Estimates the network fee (in XYM) for sending `amountXym` to `recipientAddress`, without
 * signing or broadcasting anything - used by the confirmation screen before the person
 * enters their PIN. `senderPublicKeyHex` is not secret, so this never needs the PIN.
 */
export async function estimateSymbolSendFee(senderPublicKeyHex: string, recipientAddress: string, amountXym: string, message: string): Promise<string> {
  const facade = new SymbolFacade(symbolNetworkName());
  const typedDescriptor = buildTransferDescriptor(recipientAddress, amountXym || '0', message);
  const feeMultiplier = await fetchFeeMultiplier();
  const transaction = facade.createTransactionFromTypedDescriptor(
    typedDescriptor,
    new PublicKey(senderPublicKeyHex),
    feeMultiplier,
    2 * 60 * 60,
  );
  return microToDisplay(transaction.fee.value);
}

/**
 * Signs and broadcasts a Symbol XYM transfer. `privateKeyHex` is this wallet's already-
 * derived Symbol private key (see lib/symbolAccount.ts) - the caller is responsible for
 * having decrypted it with the person's PIN first.
 */
export async function sendSymbolTransfer(privateKeyHex: string, recipientAddress: string, amountXym: string, message: string): Promise<{ hash: string }> {
  const facade = new SymbolFacade(symbolNetworkName());
  const privateKey = new PrivateKey(privateKeyHex);
  const account = facade.createAccount(privateKey);

  const typedDescriptor = buildTransferDescriptor(recipientAddress, amountXym, message);
  const feeMultiplier = await fetchFeeMultiplier();
  const transaction = facade.createTransactionFromTypedDescriptor(typedDescriptor, account.publicKey, feeMultiplier, 2 * 60 * 60);

  const signature = account.signTransaction(transaction);
  const jsonPayload = SymbolTransactionFactory.attachSignature(transaction, signature);
  const hash = facade.hashTransaction(transaction).toString();

  await withNodeFallback(async (nodeUrl) => {
    const response = await fetch(`${nodeUrl}/transactions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: jsonPayload,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || `Send failed (status ${response.status})`);
    }
  });

  return { hash };
}
