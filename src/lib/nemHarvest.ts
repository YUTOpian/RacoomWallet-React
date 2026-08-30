import { PrivateKey, PublicKey } from 'symbol-sdk';
import {
  NemFacade, KeyPair, descriptors, models, TransactionFactory as NemTransactionFactory,
} from 'symbol-sdk/nem';
import {
  getNodeUrls, withNodeFallback, fetchJson, microToDisplay, nemNetworkName,
} from './nemChain';

// See lib/nemAccount.ts / lib/nemChain.ts for why this is needed - same global runtime
// switch, safe to set again from this entry point.
if (typeof process !== 'undefined' && process.env) {
  process.env.SYMBOL_SDK_NO_WASM = '1';
}

/**
 * Delegated ("remote") harvesting for NEM mainnet.
 *
 * NEM's version of this is considerably simpler than Symbol's (see lib/symbolHarvest.ts)
 * but also more old-fashioned:
 *  - Activating just means signing a single ACCOUNT_KEY_LINK transaction (classic NEM
 *    called this an "importance transfer transaction") that links the wallet's account to
 *    a freshly generated throwaway "remote" keypair. There's no separate VRF key and no
 *    node key link - NEM's chain-level notion of harvesting delegation only concerns the
 *    account <-> remote link, nothing else.
 *  - There's no on-chain concept of "which node" a remote key is delegated to. Whichever
 *    NIS node currently has the remote *private* key unlocked (via POST /account/unlock)
 *    is the one that will actually harvest blocks on the account's behalf, and that can be
 *    changed at any time without touching the chain - "selecting a node" below is really
 *    just "which node's REST API should this request go to", not part of the transaction.
 *  - Unlocking is literally handing the node the remote account's raw private key over
 *    HTTPS so it can sign blocks with it; this is how NEM always worked; there's no
 *    encrypted-delegation mechanism like Symbol's MessageEncoder here. Most public nodes
 *    also don't accept unlock requests from arbitrary strangers (nis.unlockedLimit=0), so
 *    this step can fail even when the on-chain link succeeds - that's a real limitation of
 *    the network, not a bug in this screen.
 */

export interface HarvestingNodeOption {
  url: string;
  friendlyName: string;
  host: string;
}

export type NemRemoteStatus = 'ACTIVE' | 'ACTIVATING' | 'DEACTIVATING' | 'INACTIVE' | 'REMOTE' | 'UNKNOWN';

export interface HarvestingStatus {
  remoteStatus: NemRemoteStatus;
  importance: number;
  harvestedBlocks: number;
}

/**
 * Queries every known node's /node/info in parallel and returns the ones that answered -
 * used to populate the node picker. Best-effort: unreachable nodes are silently dropped.
 * Mirrors fetchHarvestingNodeOptions in lib/symbolHarvest.ts, but NIS's /node/info shape is
 * `{ identity: { name, publicKey }, endpoint: { host, ... } }` rather than Symbol REST's
 * flat `{ friendlyName, host, publicKey }` - and the node's publicKey isn't meaningful here
 * (see file header), so it isn't carried into HarvestingNodeOption at all.
 */
export async function fetchHarvestingNodeOptions(): Promise<HarvestingNodeOption[]> {
  const results = await Promise.allSettled(
    getNodeUrls().map(async (url) => {
      const { body } = await fetchJson(url, '/node/info');
      const host = body?.endpoint?.host || url;
      const friendlyName = body?.identity?.name || host;
      return { url, friendlyName, host } as HarvestingNodeOption;
    }),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<HarvestingNodeOption> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Resolves a single, person-entered node REST URL into a HarvestingNodeOption, for the
 * "URLを直接入力" path on the node-selection screen. Accepts URLs with or without a scheme
 * (defaulting to https://) and normalizes away a trailing slash, mirroring
 * fetchHarvestingNodeOptionByUrl in lib/symbolHarvest.ts.
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
    console.error('Failed to reach the manually entered NEM node', e);
    throw new Error("Couldn't connect to the node. Please check the URL.");
  }
  const host = body?.endpoint?.host || url;
  const friendlyName = body?.identity?.name || host;
  return { url, friendlyName, host };
}

function normalizeRemoteStatus(raw: unknown): NemRemoteStatus {
  const value = typeof raw === 'string' ? raw.toUpperCase() : '';
  if (value === 'ACTIVE' || value === 'ACTIVATING' || value === 'DEACTIVATING' || value === 'INACTIVE' || value === 'REMOTE') {
    return value;
  }
  return 'UNKNOWN';
}

/**
 * Reads the account's current delegated-harvesting status from chain. Unlike Symbol's
 * /accounts/{address} (which returns the actual linked/vrf/node public keys - see
 * fetchHarvestingStatus in lib/symbolHarvest.ts), NIS's /account/get only ever reports
 * *whether* a remote is linked (meta.remoteStatus) - never *which* remote public key it is.
 * That's why the remote public key has to be remembered locally after activation (see
 * saveHarvestingLinkInfo below) rather than re-derived from chain when building the
 * deactivation transaction.
 */
export async function fetchHarvestingStatus(address: string): Promise<HarvestingStatus> {
  return withNodeFallback(async (nodeUrl) => {
    const { body } = await fetchJson(nodeUrl, `/account/get?address=${address}`);
    return {
      remoteStatus: normalizeRemoteStatus(body?.meta?.remoteStatus),
      importance: Number(body?.account?.importance ?? 0),
      harvestedBlocks: Number(body?.account?.harvestedBlocks ?? 0),
    };
  });
}

/** Freshly generated throwaway keypair handed to the harvesting node - never the wallet's own key. */
export interface HarvestingKeyPair {
  remoteKeyPair: InstanceType<typeof KeyPair>;
}

export function generateHarvestingKeyPair(): HarvestingKeyPair {
  return { remoteKeyPair: new KeyPair(PrivateKey.random()) };
}

// NIS's own fee schedule (see node_modules/symbol-sdk/src/nem/FeeCalculator.js) weights any
// non-TRANSFER, non-MULTISIG_ACCOUNT_MODIFICATION transaction - which ACCOUNT_KEY_LINK is -
// at a flat 3 fee units (0.05 XEM each), i.e. 0.15 XEM, regardless of content. That's a
// fixed local constant, not something that needs a node round-trip to compute (mirrors
// estimateNemSendFee in lib/nemChain.ts, which is local for the same reason).
const IMPORTANCE_TRANSFER_FEE_MICRO = 150_000n;

/**
 * Estimates the network fee (in XEM) for the account-key-link (importance transfer)
 * transaction. Kept async/Promise-returning for symmetry with the rest of this module's
 * call sites (and in case a future NIS fee schedule change needs a network lookup), even
 * though today's answer never varies.
 */
export async function estimateHarvestLinkFee(): Promise<string> {
  return microToDisplay(IMPORTANCE_TRANSFER_FEE_MICRO);
}

/**
 * Signs and broadcasts the account-key-link (importance transfer) transaction that
 * activates or deactivates delegated harvesting. `privateKeyHex` is this wallet's
 * already-decrypted NEM private key (see lib/nemAccount.ts) - the caller is responsible
 * for having decrypted it with the person's PIN first. `remotePublicKeyHex` must be the
 * same remote public key for both the link and the later unlink (see file header) - the
 * caller supplies it either fresh (link) or from saveHarvestingLinkInfo (unlink).
 */
export async function signAndAnnounceHarvestLink(
  privateKeyHex: string,
  remotePublicKeyHex: string,
  action: 'link' | 'unlink',
): Promise<{ hash: string }> {
  const facade = new NemFacade(nemNetworkName());
  const privateKey = new PrivateKey(privateKeyHex);
  const account = facade.createAccount(privateKey);

  const linkAction = action === 'link' ? models.LinkAction.LINK : models.LinkAction.UNLINK;
  const descriptor = new descriptors.AccountKeyLinkTransactionV1Descriptor(linkAction, new PublicKey(remotePublicKeyHex));
  const transaction = facade.createTransactionFromTypedDescriptor(descriptor, account.publicKey, IMPORTANCE_TRANSFER_FEE_MICRO, 2 * 60 * 60);

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
    // Same quirk as sendNemTransfer in lib/nemChain.ts - NIS's /transaction/announce
    // always answers HTTP 200, even on failure; success is signaled by body.code (1).
    if (!response.ok || (body?.code != null && body.code !== 1)) {
      throw new Error(body?.message || `Send failed (code ${body?.code ?? response.status})`);
    }
  });

  return { hash };
}

/**
 * Polls the account's on-chain remote status until it reflects the requested action (or
 * times out). NIS has no per-hash "transactionStatus" lookup the way Symbol REST does (see
 * waitForHarvestLinkConfirmation in lib/symbolHarvest.ts), so this polls meta.remoteStatus
 * itself instead: it moves through ACTIVATING -> ACTIVE (for a link) or
 * DEACTIVATING -> INACTIVE (for an unlink) as the transaction gets included in a block.
 * There's no reliable way to distinguish "still unconfirmed" from "the network rejected it"
 * from this signal alone, so unlike Symbol's version this never resolves to 'failed' - a
 * genuinely rejected transaction just reads as a timeout.
 */
export async function waitForHarvestLinkConfirmation(
  address: string,
  action: 'link' | 'unlink',
  { intervalMs = 4000, maxAttempts = 15 }: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<'confirmed' | 'timeout'> {
  const target: NemRemoteStatus = action === 'link' ? 'ACTIVE' : 'INACTIVE';
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
    try {
      // eslint-disable-next-line no-await-in-loop
      const status = await fetchHarvestingStatus(address);
      if (status.remoteStatus === target) return 'confirmed';
    } catch (e) {
      console.warn('Failed to poll NEM remote-harvesting status', e);
    }
  }
  return 'timeout';
}

/**
 * Hands the throwaway remote account's private key to the chosen node so it starts
 * harvesting with it. Must only be called after the account-key-link transaction above is
 * confirmed on chain (the node's own /account/get check will otherwise reject it). Many
 * public nodes refuse unlock requests from anyone but their own operator
 * (nis.unlockedLimit=0) - that's a normal, expected failure here, not a bug.
 */
export async function submitNodeUnlockRequest(nodeUrl: string, remotePrivateKeyHex: string): Promise<void> {
  const response = await fetch(`${nodeUrl}/account/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKey: remotePrivateKeyHex }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body?.code != null && body.code !== 1)) {
    throw new Error(body?.message || `Failed to register harvest delegation with the node (status ${response.status})`);
  }
}

/**
 * Tells the node to stop harvesting with the remote account's private key. Only callable
 * while that private key is still available in memory (i.e. right after activating, in the
 * same session) - since it's never persisted (see file header), stopping harvesting from a
 * later session can only remove the on-chain link (signAndAnnounceHarvestLink with
 * action='unlink'), not proactively notify the node. That's non-fatal: once the link is
 * removed on chain, blocks the node produces with the now-unlinked key stop counting as
 * this account's harvesting, so the node naturally stops mattering even if it's still
 * technically "unlocked" until it restarts.
 */
export async function revokeNodeUnlockRequest(nodeUrl: string, remotePrivateKeyHex: string): Promise<void> {
  const response = await fetch(`${nodeUrl}/account/lock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ privateKey: remotePrivateKeyHex }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || (body?.code != null && body.code !== 1)) {
    throw new Error(body?.message || `The stop request to the node failed (status ${response.status})`);
  }
}

/**
 * Remembers which remote public key + node URL a wallet last activated harvesting with, so
 * the "stop harvesting" flow can build the required unlink transaction (see file header for
 * why the remote public key can't be re-derived from chain) and, session permitting, notify
 * the right node. Plain localStorage, keyed by wallet id - operational state, not secret
 * material (the remote *private* key itself is never persisted here or anywhere else in
 * this app - see generateHarvestingKeyPair).
 */
export interface HarvestingLinkInfo {
  remotePublicKey: string;
  nodeUrl: string;
}

const LINK_INFO_STORAGE_PREFIX = 'nem_harvest_link_';

export function saveHarvestingLinkInfo(walletId: string, info: HarvestingLinkInfo): void {
  try {
    window.localStorage.setItem(`${LINK_INFO_STORAGE_PREFIX}${walletId}`, JSON.stringify(info));
  } catch (e) {
    console.warn('Failed to persist NEM harvesting link info', e);
  }
}

export function loadHarvestingLinkInfo(walletId: string): HarvestingLinkInfo | null {
  try {
    const raw = window.localStorage.getItem(`${LINK_INFO_STORAGE_PREFIX}${walletId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.remotePublicKey === 'string' && typeof parsed?.nodeUrl === 'string') {
      return parsed as HarvestingLinkInfo;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearHarvestingLinkInfo(walletId: string): void {
  try {
    window.localStorage.removeItem(`${LINK_INFO_STORAGE_PREFIX}${walletId}`);
  } catch (e) {
    console.warn('Failed to clear NEM harvesting link info', e);
  }
}
