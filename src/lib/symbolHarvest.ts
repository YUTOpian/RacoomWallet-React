import { PrivateKey, PublicKey, utils } from 'symbol-sdk';
import {
  SymbolFacade, KeyPair, MessageEncoder, descriptors, models, SymbolTransactionFactory,
} from 'symbol-sdk/symbol';
import {
  getNodeUrls, withNodeFallback, fetchJson, fetchFeeMultiplier, microToDisplay, symbolNetworkName,
} from './symbolChain';

// See lib/symbolAccount.ts / lib/symbolChain.ts for why this is needed - same global
// runtime switch, safe to set again from this entry point.
if (typeof process !== 'undefined' && process.env) {
  process.env.SYMBOL_SDK_NO_WASM = '1';
}

/**
 * Delegated (remote) harvesting setup for Symbol mainnet.
 *
 * Activating harvesting requires three "key link" transactions (account/VRF/node),
 * announced together as a single self-signed aggregate so they take effect atomically,
 * followed by handing the freshly generated remote+VRF *private* keys to the chosen
 * harvesting node so it can actually produce blocks on the account's behalf. That second
 * step never touches the account's own private key or funds - only the two throwaway keys
 * generated for this purpose - and is encrypted for the node using symbol-sdk's own
 * MessageEncoder.encodePersistentHarvestingDelegation, the same mechanism the official
 * wallets use (see node_modules/symbol-sdk/src/symbol/MessageEncoder.js).
 *
 * Node selection deliberately reuses lib/symbolChain.ts's getNodeUrls() (already known to
 * be reachable and CORS-enabled from this app) rather than crawling /node/peers or
 * depending on a third-party statistics service - both would risk surfacing nodes this
 * browser app can't actually reach or that block cross-origin requests. getNodeUrls()
 * already resolves to the mainnet or testnet list per 設定 > テストネットモード, same as every
 * other Symbol REST call in the app.
 */

export interface HarvestingNodeOption {
  url: string;
  publicKey: string;
  friendlyName: string;
  host: string;
}

export interface HarvestingStatus {
  linkedPublicKey: string | null; // "remote" account public key
  vrfPublicKey: string | null;
  nodePublicKey: string | null;
}

/**
 * Queries every known node's /node/info in parallel and returns the ones that answered -
 * used to populate the node picker. Best-effort: unreachable nodes are silently dropped.
 */
export async function fetchHarvestingNodeOptions(): Promise<HarvestingNodeOption[]> {
  const results = await Promise.allSettled(
    getNodeUrls().map(async (url) => {
      const { body } = await fetchJson(url, '/node/info');
      const option: HarvestingNodeOption = {
        url,
        publicKey: body?.publicKey ?? '',
        friendlyName: body?.friendlyName || body?.host || url,
        host: body?.host || url,
      };
      if (!option.publicKey) throw new Error('missing node public key');
      return option;
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<HarvestingNodeOption> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Resolves a single, person-entered node REST URL into a HarvestingNodeOption, for the
 * "URLを直接入力" path on the node-selection screen (alongside the auto-discovered list
 * from fetchHarvestingNodeOptions above, which only ever checks the small known-good
 * getNodeUrls() list). Accepts URLs with or without a scheme (defaulting to https://) and
 * normalizes away a trailing slash before hitting /node/info, since that's the most common
 * way people paste node addresses copied from node-list sites.
 */
export async function fetchHarvestingNodeOptionByUrl(rawUrl: string): Promise<HarvestingNodeOption> {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Please enter the node URL');
  }
  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let body: any;
  try {
    ({ body } = await fetchJson(url, '/node/info'));
  } catch (e) {
    console.error('Failed to reach the manually entered Symbol node', e);
    throw new Error("Couldn't connect to the node. Please check the URL.");
  }
  if (!body?.publicKey) {
    throw new Error("Couldn't fetch node information. Please check the Symbol node's public URL.");
  }
  return {
    url,
    publicKey: body.publicKey,
    friendlyName: body.friendlyName || body.host || url,
    host: body.host || url,
  };
}

/**
 * Looks up a node's public key from its REST URL - used to resolve the REST endpoint to
 * call when stopping harvesting on a node the person didn't just pick from the list above
 * (e.g. after reopening the app), by re-checking which of the known nodes' keys matches
 * what's linked on-chain.
 */
export async function findNodeOptionByPublicKey(nodePublicKey: string): Promise<HarvestingNodeOption | null> {
  const options = await fetchHarvestingNodeOptions();
  return options.find((o) => o.publicKey.toUpperCase() === nodePublicKey.toUpperCase()) ?? null;
}

/**
 * Reads the account's current supplemental public keys (linked/vrf/node) from chain - this
 * is how harvesting on/off state is determined; there's no separate "harvesting enabled"
 * flag, only whether these three links exist.
 */
export async function fetchHarvestingStatus(address: string): Promise<HarvestingStatus> {
  return withNodeFallback(async (nodeUrl) => {
    const { status, body } = await fetchJson(nodeUrl, `/accounts/${address}`);
    if (status === 404) {
      return { linkedPublicKey: null, vrfPublicKey: null, nodePublicKey: null };
    }
    const keys = body?.account?.supplementalPublicKeys ?? {};
    return {
      linkedPublicKey: keys.linked?.publicKey ?? null,
      vrfPublicKey: keys.vrf?.publicKey ?? null,
      nodePublicKey: keys.node?.publicKey ?? null,
    };
  });
}

/** Freshly generated throwaway keys handed to the harvesting node - never the wallet's own key. */
export interface HarvestingKeyPairs {
  remoteKeyPair: InstanceType<typeof KeyPair>;
  vrfKeyPair: InstanceType<typeof KeyPair>;
}

export function generateHarvestingKeyPairs(): HarvestingKeyPairs {
  return {
    remoteKeyPair: new KeyPair(PrivateKey.random()),
    vrfKeyPair: new KeyPair(PrivateKey.random()),
  };
}

function buildKeyLinkDescriptors(
  action: InstanceType<typeof models.LinkAction>,
  remotePublicKeyHex: string,
  vrfPublicKeyHex: string,
  nodePublicKeyHex: string,
) {
  return [
    new descriptors.AccountKeyLinkTransactionV1Descriptor(new PublicKey(remotePublicKeyHex), action),
    new descriptors.VrfKeyLinkTransactionV1Descriptor(new PublicKey(vrfPublicKeyHex), action),
    new descriptors.NodeKeyLinkTransactionV1Descriptor(new PublicKey(nodePublicKeyHex), action),
  ];
}

function buildAggregateFromDescriptors(facade: InstanceType<typeof SymbolFacade>, signerPublicKey: InstanceType<typeof PublicKey>, typedDescriptors: object[]) {
  const embeddedTransactions = typedDescriptors.map((d) => facade.createEmbeddedTransactionFromTypedDescriptor(d, signerPublicKey));
  const transactionsHash = SymbolFacade.hashEmbeddedTransactions(embeddedTransactions);
  return new descriptors.AggregateCompleteTransactionV2Descriptor(transactionsHash, embeddedTransactions);
}

/**
 * Estimates the network fee (in XYM) for the link/unlink aggregate, without signing or
 * broadcasting - mirrors estimateSymbolSendFee in lib/symbolChain.ts.
 */
export async function estimateHarvestLinkFee(
  senderPublicKeyHex: string,
  remotePublicKeyHex: string,
  vrfPublicKeyHex: string,
  nodePublicKeyHex: string,
  action: 'link' | 'unlink',
): Promise<string> {
  const facade = new SymbolFacade(symbolNetworkName());
  const signerPublicKey = new PublicKey(senderPublicKeyHex);
  const linkAction = action === 'link' ? models.LinkAction.LINK : models.LinkAction.UNLINK;
  const typedDescriptors = buildKeyLinkDescriptors(linkAction, remotePublicKeyHex, vrfPublicKeyHex, nodePublicKeyHex);
  const aggregateDescriptor = buildAggregateFromDescriptors(facade, signerPublicKey, typedDescriptors);
  const feeMultiplier = await fetchFeeMultiplier();
  const transaction = facade.createTransactionFromTypedDescriptor(aggregateDescriptor, signerPublicKey, feeMultiplier, 2 * 60 * 60, 0);
  return microToDisplay(transaction.fee.value);
}

/**
 * Signs and broadcasts the account/VRF/node key-link aggregate. `privateKeyHex` is this
 * wallet's already-decrypted Symbol private key (see lib/symbolAccount.ts) - the caller is
 * responsible for having decrypted it with the person's PIN first. Since all three embedded
 * transactions and the aggregate itself are signed by the same account, no other
 * cosignatures are required (aggregate *complete*, not bonded).
 */
export async function signAndAnnounceHarvestLink(
  privateKeyHex: string,
  remotePublicKeyHex: string,
  vrfPublicKeyHex: string,
  nodePublicKeyHex: string,
  action: 'link' | 'unlink',
): Promise<{ hash: string }> {
  const facade = new SymbolFacade(symbolNetworkName());
  const privateKey = new PrivateKey(privateKeyHex);
  const account = facade.createAccount(privateKey);

  const linkAction = action === 'link' ? models.LinkAction.LINK : models.LinkAction.UNLINK;
  const typedDescriptors = buildKeyLinkDescriptors(linkAction, remotePublicKeyHex, vrfPublicKeyHex, nodePublicKeyHex);
  const aggregateDescriptor = buildAggregateFromDescriptors(facade, account.publicKey, typedDescriptors);
  const feeMultiplier = await fetchFeeMultiplier();
  const transaction = facade.createTransactionFromTypedDescriptor(aggregateDescriptor, account.publicKey, feeMultiplier, 2 * 60 * 60, 0);

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

/**
 * Polls /transactionStatus/{hash} until the aggregate is confirmed (or fails / times out).
 * Node unlocking is only meaningful once the key links it depends on are actually on chain,
 * so the harvesting screen waits for this before calling submitNodeUnlockRequest.
 */
export async function waitForHarvestLinkConfirmation(
  hash: string,
  { intervalMs = 4000, maxAttempts = 15 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<'confirmed' | 'failed' | 'timeout'> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
    try {
      // eslint-disable-next-line no-await-in-loop
      const { status, body } = await withNodeFallback((nodeUrl) => fetchJson(nodeUrl, `/transactionStatus/${hash}`));
      if (status === 200) {
        if (body?.group === 'confirmed') return 'confirmed';
        if (body?.group === 'failed') return 'failed';
      }
    } catch (e) {
      console.warn('Failed to poll Symbol transaction status', e);
    }
  }
  return 'timeout';
}

/**
 * Hands the throwaway remote+VRF private keys to the chosen node, encrypted for that node's
 * public key (never sent in the clear, and never touches the account's own private key).
 * Must only be called after the key-link aggregate above is confirmed on chain - the node
 * verifies the links before it will actually harvest.
 */
export async function submitNodeUnlockRequest(
  nodeUrl: string,
  nodePublicKeyHex: string,
  keyPairs: HarvestingKeyPairs,
): Promise<void> {
  const encoder = new MessageEncoder(keyPairs.remoteKeyPair);
  const encoded = encoder.encodePersistentHarvestingDelegation(
    new PublicKey(nodePublicKeyHex),
    keyPairs.remoteKeyPair,
    keyPairs.vrfKeyPair,
  );
  const unlockInfo = utils.uint8ToHex(encoded);

  const response = await fetch(`${nodeUrl}/node/unlockedaccount`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unlockInfo }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || `Failed to register harvest delegation with the node (status ${response.status})`);
  }
}

/**
 * Tells the node to stop harvesting on this account's behalf. Takes the *remote* (linked)
 * public key, not the node's own - that's how the node identifies which delegated account
 * to drop from its unlocked set.
 */
export async function revokeNodeUnlockRequest(nodeUrl: string, remotePublicKeyHex: string): Promise<void> {
  const response = await fetch(`${nodeUrl}/node/unlockedaccount`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountPublicKey: remotePublicKeyHex }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || `The stop request to the node failed (status ${response.status})`);
  }
}

/**
 * Remembers which node URL a wallet last activated harvesting on, so the "stop harvesting"
 * flow can reach the right node's REST API later without re-crawling the whole node list
 * (its on-chain nodePublicKey alone doesn't tell us the REST URL to call). Plain
 * localStorage, keyed by wallet id - this is operational state, not secret material (the
 * throwaway keys themselves are never persisted here or anywhere else in this app).
 */
const NODE_URL_STORAGE_PREFIX = 'symbol_harvest_node_url_';

export function saveHarvestingNodeUrl(walletId: string, nodeUrl: string): void {
  try {
    window.localStorage.setItem(`${NODE_URL_STORAGE_PREFIX}${walletId}`, nodeUrl);
  } catch (e) {
    console.warn('Failed to persist harvesting node URL', e);
  }
}

export function loadHarvestingNodeUrl(walletId: string): string | null {
  try {
    return window.localStorage.getItem(`${NODE_URL_STORAGE_PREFIX}${walletId}`);
  } catch {
    return null;
  }
}

export function clearHarvestingNodeUrl(walletId: string): void {
  try {
    window.localStorage.removeItem(`${NODE_URL_STORAGE_PREFIX}${walletId}`);
  } catch (e) {
    console.warn('Failed to clear harvesting node URL', e);
  }
}
