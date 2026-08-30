import { PrivateKey } from 'symbol-sdk';
import { NemFacade } from 'symbol-sdk/nem';
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { nemNetworkName } from './nemChain';

// Same WASM-avoidance fix as lib/symbolAccount.ts - symbol-sdk's ed25519 implementation
// (src/impl/ed25519.js) is a single shared module used by both the Symbol *and* NEM
// facades, and it picks a Node-only WASM backend whenever `globalThis.WebAssembly` exists
// (true in every browser, not just Node). This env var is a global (not per-module)
// runtime switch read by that shared module, so setting it here as well as in
// symbolAccount.ts is redundant-but-harmless insurance against import order - whichever of
// the two modules loads first is enough, but there's no guarantee which one that is.
if (typeof process !== 'undefined' && process.env) {
  process.env.SYMBOL_SDK_NO_WASM = '1';
}

/**
 * Derives a NEM (XEM) account from the same EVM (secp256k1) private key already used for
 * this wallet's Ethereum/Polygon/Kaia/Avalanche account (see lib/mnemonic.ts's
 * PrivateKeyHelper/EvmAccount) - one recovery phrase backs up every chain this wallet
 * supports. Mirrors lib/symbolAccount.ts's approach exactly (HMAC-SHA512 "seed" derivation,
 * SLIP-10 master-key style, no further BIP44 child derivation needed since there's only
 * ever one NEM account per wallet) but with a different domain-separation string
 * ("nem seed" instead of "ed25519 seed") so the NEM and Symbol accounts derived from the
 * same wallet are unrelated keys, not the same key reused across two chains.
 */

export interface NemAccount {
  address: string;
  publicKey: string;
  privateKeyHex: string;
}

interface Bip32NodeLike {
  privateKey: Uint8Array;
  chainCode: Uint8Array;
}

function hmacSha512(key: Uint8Array, data: Uint8Array): Bip32NodeLike {
  const result = hmac(sha512, key, data);
  return { privateKey: result.slice(0, 32), chainCode: result.slice(32) };
}

function derivePrivateKey(evmPrivateKeyHex: string): PrivateKey {
  const normalized = evmPrivateKeyHex.trim().replace(/^0x/i, '');
  const secretBytes = new Uint8Array(Buffer.from(normalized, 'hex'));
  const node = hmacSha512(new TextEncoder().encode('nem seed'), secretBytes);
  return new PrivateKey(node.privateKey);
}

export class NemAccountHelper {
  /**
   * Derives the NEM address, public key and private key (on whichever network - mainnet
   * or 設定 > テストネットモード's testnet - is currently active; see lib/nemChain.ts's
   * nemNetworkName) from this wallet's EVM private key. Only ever called with an
   * already-decrypted private key (see WalletsHelper.decryptKey + a PIN check) - never
   * persisted. Note that unlike this wallet's EVM address, the NEM address is different
   * per network (the network identifier byte is baked into the address itself), so
   * callers must re-derive after a network-mode switch rather than reusing a previously
   * derived address - see storage.ts's per-network wallet caching.
   */
  static fromPrivateKey(evmPrivateKeyHex: string): NemAccount {
    const privateKey = derivePrivateKey(evmPrivateKeyHex);
    const facade = new NemFacade(nemNetworkName());
    const account = facade.createAccount(privateKey);
    return {
      address: account.address.toString(),
      publicKey: account.publicKey.toString(),
      privateKeyHex: privateKey.toString(),
    };
  }
}

// Re-exported so callers building/signing transactions (lib/nemChain.ts) share the same
// symbol-sdk NemFacade type without importing symbol-sdk/nem directly everywhere.
export { NemFacade };
