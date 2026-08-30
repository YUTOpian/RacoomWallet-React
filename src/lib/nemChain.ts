import { PrivateKey, PublicKey } from 'symbol-sdk';
import {
  NemFacade, descriptors, models, Address as NemAddressType, TransactionFactory as NemTransactionFactory,
} from 'symbol-sdk/nem';
import { getNetworkMode } from './chains';

// See lib/nemAccount.ts for why this is needed - both files touch symbol-sdk's shared
// ed25519 implementation (this one via account.signTransaction).
if (typeof process !== 'undefined' && process.env) {
  process.env.SYMBOL_SDK_NO_WASM = '1';
}

/**
 * NEM (XEM) integration: balance/transaction reads and transfer sending, via a public NIS
 * (NEM Infrastructure Server) node. Mirrors the fallback-list pattern lib/symbolChain.ts
 * uses for Symbol REST endpoints (see withNodeFallback there) - public NEM nodes are
 * shared, unauthenticated community infrastructure that go offline without notice, so
 * reads/writes retry across a short list of currently-reachable HTTPS nodes rather than
 * depending on any single one. Unlike Symbol's REST gateway, these are legacy NIS nodes
 * running self-signed TLS certificates, so a given node may still fail in a browser even
 * while reachable by other tools - the fallback list is the mitigation.
 *
 * Mainnet vs testnet (see 設定 > テストネットモード / lib/chains.ts's NetworkMode, the single
 * source of truth this reads via getNetworkMode()) mirrors the same mutually-exclusive
 * split lib/chains.ts uses for the EVM chains - see getNodeUrls/nemNetworkName below.
 */

const MAINNET_NODE_URLS = [
  'https://nem01a.symbol-node.com:7891',
  'https://nem02.symbol-node.com:7891',
  'https://nem03.symbol-node.com:7891',
  'https://mosio.tsvr.net:7891',
  'https://norisio.tsvr.net:7891',
  'https://sioramen.tsvr.net:7891',
  'https://arasio.tsvr.net:7891',
  'https://luna2.dusanjp.com:7891',
  'https://nis1.dusanjp.com:7891',
  'https://super-nem.love:7891',
];

// Public HTTPS NEM testnet nodes are much scarcer than mainnet's (nemnodes.org's testnet
// list currently only advertises plain HTTP/7890 endpoints, not HTTPS/7891 ones), so this
// list is short and best-effort rather than a curated "known good" set like mainnet's
// above - it may need refreshing from https://nemnodes.org/nodes_testnet/ or the NEM forum
// if these stop responding. A browser page served over HTTPS can't call an HTTP endpoint
// (mixed content), so only HTTPS-capable testnet nodes are usable here at all.
const TESTNET_NODE_URLS = [
  'https://nistest.opening-line.jp:7891',
];

// Exported (not just module-local) so lib/nemHarvest.ts can reuse the same node list
// instead of duplicating the mainnet/testnet split - harvesting setup needs to call
// additional REST endpoints against these same nodes.
export function getNodeUrls(): string[] {
  return getNetworkMode() === 'debug' ? TESTNET_NODE_URLS : MAINNET_NODE_URLS;
}

// symbol-sdk's NemFacade network name for whichever network is currently active - 'debug'
// (this app's toggle) maps to symbol-sdk's 'testnet' network identifier.
export function nemNetworkName(): 'mainnet' | 'testnet' {
  return getNetworkMode() === 'debug' ? 'testnet' : 'mainnet';
}

// nem:xem - NEM's native currency. Mainnet-wide constant, never changes.
export const XEM_DIVISIBILITY = 6;

/**
 * Current JPY price of XEM, for the small "≈ n JPY" line under the balance - best-effort,
 * mirrors fetchSymbolJpyRate in lib/symbolChain.ts.
 */
let cachedJpyRate: number | undefined;

export async function fetchNemJpyRate(): Promise<number> {
  if (cachedJpyRate !== undefined) {
    return cachedJpyRate;
  }
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nem&vs_currencies=jpy');
    const json = await response.json();
    const rate = Number(json?.nem?.jpy ?? 0);
    cachedJpyRate = rate;
    return rate;
  } catch (e) {
    console.error('Failed to fetch XEM/JPY rate', e);
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
      console.warn(`NEM REST call failed via ${url}, trying next node`, error);
    }
  }
  throw lastError;
}

export async function fetchJson(nodeUrl: string, path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const response = await fetch(`${nodeUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`NEM REST ${path} failed with status ${response.status}`);
  }
  return { status: response.status, body };
}

export function microToDisplay(amount: string | number | bigint, divisibility: number = XEM_DIVISIBILITY): string {
  const value = typeof amount === 'bigint' ? amount : BigInt(Math.round(Number(amount)));
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const divisor = 10n ** BigInt(divisibility);
  const whole = abs / divisor;
  const fraction = (abs % divisor).toString().padStart(divisibility, '0').replace(/0+$/, '');
  const text = fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

/**
 * Fetches the XEM balance for a NEM address. NIS returns a valid (zero-balance) account
 * object even for an address that has never received anything, unlike Symbol's REST
 * gateway - there's no 404 case to special-case here.
 */
export async function fetchNemBalance(address: string): Promise<string> {
  return withNodeFallback(async (nodeUrl) => {
    const { body } = await fetchJson(nodeUrl, `/account/get?address=${address}`);
    const balance = body?.account?.balance;
    return balance != null ? microToDisplay(balance) : '0';
  });
}

export interface NemTransactionSummary {
  hash: string;
  direction: 'in' | 'out';
  counterparty: string;
  amount: string; // XEM, '' if this transfer carried no XEM (message-only edge case)
  message: string;
  timestamp: number; // epoch ms, 0 if unavailable
  height: string;
}

// NEM mainnet's network epoch (the nemesis block instant), used to convert a transaction's
// network timestamp (seconds since this epoch) into a normal epoch-ms Date. Source:
// symbol-sdk's nem/Network.js Network.MAINNET definition (epochTime).
const MAINNET_EPOCH_MS = Date.UTC(2015, 2, 29, 0, 6, 25);

function toEpochMs(networkTimestampSeconds: number | undefined): number {
  if (networkTimestampSeconds == null) return 0;
  return MAINNET_EPOCH_MS + Number(networkTimestampSeconds) * 1000;
}

function addressFromPublicKeyHex(publicKeyHex: string): string {
  try {
    const facade = new NemFacade(nemNetworkName());
    return facade.network.publicKeyToAddress(new PublicKey(publicKeyHex)).toString();
  } catch {
    return '';
  }
}

function decodeMessageHex(hex: string, messageType: number): string {
  if (!hex) return '';
  if (messageType === 2) return '(Encrypted message)';
  try {
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch {
    return '';
  }
}

function summarizeTransferTx(tx: any, selfAddress: string): NemTransactionSummary | null {
  const content = tx.transaction;
  if (content?.type !== 257) return null; // 257 = transfer transaction
  const meta = tx.meta ?? {};
  const recipient: string = content.recipient ?? '';
  const isOutgoing = recipient !== selfAddress;
  const messagePayload: string | undefined = content.message?.payload;
  const messageType: number = content.message?.type ?? 0;
  return {
    hash: meta.hash?.data ?? '',
    direction: isOutgoing ? 'out' : 'in',
    counterparty: isOutgoing ? recipient : addressFromPublicKeyHex(content.signer ?? ''),
    amount: content.amount != null ? microToDisplay(content.amount) : '',
    message: messagePayload ? decodeMessageHex(messagePayload, messageType) : '',
    timestamp: toEpochMs(content.timeStamp),
    height: meta.height != null ? String(meta.height) : '',
  };
}

/**
 * Fetches the most recent transfer transactions involving this address (both sent and
 * received), newest first. NIS's /account/transfers/all doesn't take a page-size
 * parameter - it returns its own most-recent batch - so this just takes the first
 * `pageSize` of whatever comes back.
 */
export async function fetchNemTransactions(address: string, pageSize: number = 25): Promise<NemTransactionSummary[]> {
  return withNodeFallback(async (nodeUrl) => {
    const { body } = await fetchJson(nodeUrl, `/account/transfers/all?address=${address}`);
    const data: any[] = body?.data ?? [];
    return data
      .map((tx) => summarizeTransferTx(tx, address))
      .filter((tx): tx is NemTransactionSummary => tx !== null)
      .slice(0, pageSize);
  });
}

/**
 * Minimum required fee for a plain (no-mosaic) XEM transfer, per NEM's long-standing fee
 * schedule: 0.05 XEM per 32-byte chunk of message, plus a tiered transfer fee that scales
 * with amount (min 0.05 XEM, capped at 1.25 XEM). Reimplemented by hand rather than calling
 * symbol-sdk's calculateTransactionFee, because that helper assumes a V2 (mosaic-capable)
 * transaction - it unconditionally reads `transaction.mosaics.length`, a property plain
 * TransferTransactionV1 (the type used here, and the only kind needed for plain XEM
 * transfers) doesn't have. Verified against symbol-sdk's own FeeCalculator.js source for
 * the zero-mosaic case this always hits.
 */
function calculateXemTransferFee(amountMicro: bigint, messageByteLength: number): bigint {
  const FEE_UNIT = 50_000n; // 0.05 XEM
  const amountWhole = amountMicro / 1_000_000n;
  const min = (a: bigint, b: bigint) => (a < b ? a : b);
  const max = (a: bigint, b: bigint) => (a > b ? a : b);
  const transferFeeUnits = min(25n, max(1n, amountWhole / 10000n));
  const messageFeeUnits = messageByteLength > 0 ? BigInt(Math.trunc(messageByteLength / 32) + 1) : 0n;
  return FEE_UNIT * (transferFeeUnits + messageFeeUnits);
}

function buildTransferDescriptor(recipientAddress: string, amountXem: string, message: string) {
  const amountMicro = BigInt(Math.round(Number(amountXem) * 10 ** XEM_DIVISIBILITY));
  const recipient = new NemAddressType(recipientAddress);
  const messageBytes = message.length > 0 ? new TextEncoder().encode(message) : undefined;
  const messageDescriptor = messageBytes
    ? new descriptors.MessageDescriptor(models.MessageType.PLAIN, messageBytes)
    : undefined;
  return {
    descriptor: new descriptors.TransferTransactionV1Descriptor(recipient, new models.Amount(amountMicro), messageDescriptor),
    amountMicro,
    messageByteLength: messageBytes?.length ?? 0,
  };
}

/**
 * Estimates the network fee (in XEM) for sending `amountXem` to `recipientAddress`, without
 * signing or broadcasting anything - used by the confirmation screen before the person
 * enters their PIN. Unlike Symbol (which needs a node round-trip to fetch the current fee
 * multiplier), NEM's fee schedule is a fixed, local calculation - no network call needed.
 */
export async function estimateNemSendFee(recipientAddress: string, amountXem: string, message: string): Promise<string> {
  const { amountMicro, messageByteLength } = buildTransferDescriptor(recipientAddress, amountXem || '0', message);
  return microToDisplay(calculateXemTransferFee(amountMicro, messageByteLength));
}

/**
 * Signs and broadcasts a NEM XEM transfer. `privateKeyHex` is this wallet's already-derived
 * NEM private key (see lib/nemAccount.ts) - the caller is responsible for having decrypted
 * it with the person's PIN first.
 */
export async function sendNemTransfer(privateKeyHex: string, recipientAddress: string, amountXem: string, message: string): Promise<{ hash: string }> {
  const facade = new NemFacade(nemNetworkName());
  const privateKey = new PrivateKey(privateKeyHex);
  const account = facade.createAccount(privateKey);

  const { descriptor: typedDescriptor, amountMicro, messageByteLength } = buildTransferDescriptor(recipientAddress, amountXem, message);
  const fee = calculateXemTransferFee(amountMicro, messageByteLength);
  const transaction = facade.createTransactionFromTypedDescriptor(typedDescriptor, account.publicKey, fee, 2 * 60 * 60);

  const signature = account.signTransaction(transaction);
  const jsonPayload = NemTransactionFactory.attachSignature(transaction, signature);
  const hash = facade.hashTransaction(transaction).toString();

  await withNodeFallback(async (nodeUrl) => {
    const response = await fetch(`${nodeUrl}/transaction/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonPayload,
    });
    const body = await response.json().catch(() => ({}));
    // NIS's /transaction/announce always returns HTTP 200, even on failure - success/
    // failure is signaled by the response body's `code` (1 = success) instead.
    if (!response.ok || (body?.code != null && body.code !== 1)) {
      throw new Error(body?.message || `Send failed (code ${body?.code ?? response.status})`);
    }
  });

  return { hash };
}
