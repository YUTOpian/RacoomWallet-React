import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade, KeyPair } from 'symbol-sdk/symbol';
import { hmac } from '@noble/hashes/hmac.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { symbolNetworkName } from './symbolChain';

// symbol-sdk's ed25519 implementation (src/impl/ed25519.js) picks a WASM backend
// (symbol-crypto-wasm-node) whenever `globalThis.WebAssembly` exists - which is true in
// every browser too, not just Node. That backend loads its .wasm file with Node's `fs`/
// `path`/`__dirname`, which don't work in a bundled browser build (see vite.config.ts's
// polyfill comment for the build-time half of this). Setting this env var makes it fall
// back to its pure-JS implementation (ed25519_js.js) instead - the same code path
// symbol-sdk itself uses on React Native, where WebAssembly support is also unreliable.
// Must run before any SymbolFacade call that touches keys, so it's set here at module
// load rather than deferred into a function.
if (typeof process !== 'undefined' && process.env) {
  process.env.SYMBOL_SDK_NO_WASM = '1';
}

/**
 * Derives a Symbol (XYM) account from the same EVM (secp256k1) private key already used
 * for this wallet's Ethereum/Polygon/Kaia account (see lib/mnemonic.ts's
 * PrivateKeyHelper/EvmAccount) - one key backs up both. Symbol uses ed25519 keys, which is
 * an unrelated curve from EVM's secp256k1, so there's no "shared" key material as such;
 * instead the raw EVM private key bytes are used as input entropy to deterministically
 * derive a completely separate ed25519 keypair, the same way a BIP39 seed feeds SLIP-10-style
 * derivation - just without a mnemonic-to-seed step or further child derivation, since a raw
 * private key has no BIP44 tree under it and this wallet only ever needs one Symbol account
 * per EVM account.
 *
 * symbol-sdk ships its own Bip32 helper (Bip32Node in Bip32.js) for the mnemonic-based
 * version of this derivation, but it pulls in Node's `crypto` and `bitcore-mnemonic`, which
 * need extra bundler polyfills to work in a browser build. This re-implements the same
 * HMAC-SHA512 "ed25519 seed" master-key step by hand using @noble/hashes (pure JS,
 * browser-safe) - verified byte-for-byte against symbol-sdk's own Bip32 class before wiring
 * this in.
 */

export interface SymbolAccount {
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

/**
 * Derives the Symbol ed25519 private key from this wallet's raw EVM (secp256k1) private
 * key. This is just the SLIP-10 "ed25519 seed" master-key step (HMAC-SHA512 keyed with the
 * literal string "ed25519 seed") applied directly to the EVM private key's bytes, with no
 * further BIP44 child derivation - there's no mnemonic/seed tree here, only a single fixed
 * 32-byte key, so one master-key derivation is enough to get a deterministic, wallet-specific
 * ed25519 key that's unrelated to the EVM key on any curve-crossing level.
 */
function derivePrivateKey(evmPrivateKeyHex: string): PrivateKey {
  const normalized = evmPrivateKeyHex.trim().replace(/^0x/i, '');
  const secretBytes = new Uint8Array(Buffer.from(normalized, 'hex'));
  const node = hmacSha512(new TextEncoder().encode('ed25519 seed'), secretBytes);
  return new PrivateKey(node.privateKey);
}

export class SymbolAccountHelper {
  /**
   * Derives the Symbol address, public key and private key (on whichever network -
   * mainnet or 設定 > テストネットモード's testnet - is currently active; see
   * lib/symbolChain.ts's symbolNetworkName) from this wallet's EVM private key. Only ever
   * called with an already-decrypted private key (see WalletsHelper.decryptKey + a PIN
   * check) - never persisted. Note that unlike this wallet's EVM address, the Symbol
   * address is different per network (the network identifier byte is baked into the
   * address itself), so callers must re-derive after a network-mode switch rather than
   * reusing a previously derived address - see storage.ts's per-network wallet caching.
   */
  static fromPrivateKey(evmPrivateKeyHex: string): SymbolAccount {
    const privateKey = derivePrivateKey(evmPrivateKeyHex);
    const facade = new SymbolFacade(symbolNetworkName());
    const account = facade.createAccount(privateKey);
    return {
      address: account.address.toString(),
      publicKey: account.publicKey.toString(),
      privateKeyHex: privateKey.toString(),
    };
  }
}

// Re-exported so callers building/signing transactions (lib/symbolChain.ts) share the same
// symbol-sdk KeyPair/PrivateKey types without importing symbol-sdk directly everywhere.
export { PrivateKey as SymbolPrivateKey, KeyPair as SymbolKeyPair, SymbolFacade };
