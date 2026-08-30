import { ed25519 } from '@noble/curves/ed25519.js';
import { eddsa } from '@noble/curves/abstract/edwards.js';
import { keccak_512 } from '@noble/hashes/sha3.js';

// Stub for the 'symbol-crypto-wasm-node' package, aliased in vite.config.ts.
//
// symbol-sdk's ed25519 implementation (src/impl/ed25519.js) always statically imports
// both its WASM backend (this package, via src/impl/ed25519_wasm.js) and its pure-JS
// backend, picking one at runtime with:
//   globalThis.WebAssembly && !process.env.SYMBOL_SDK_NO_WASM ? wasm : js
// `globalThis.WebAssembly` exists in every browser too (not just Node), and an earlier
// attempt to flip this via `process.env.SYMBOL_SDK_NO_WASM` at runtime didn't work: Vite's
// node-polyfill plugin statically replaces `process.env` with a fresh, disconnected `{}`
// object literal at *build time*, so a runtime mutation to one `process.env` reference
// never becomes visible to a different `process.env` reference elsewhere in the bundle -
// the WASM branch kept getting picked regardless, and then crashed (this package's real
// implementation needs Node's `fs`/`path`/`__dirname` to load its .wasm file, none of
// which exist in a browser).
//
// Rather than fight that branch selection, this makes the WASM branch itself just work:
// it implements this package's three low-level primitives using @noble/curves' ed25519
// (RFC 8032, standard SHA-512 - the exact same "Sha2_512" hash mode Symbol's own
// SymbolFacade/KeyPair always uses, verified byte-for-byte against symbol-sdk's own
// implementation before wiring this in), plus a second Keccak-512 variant for NEM's
// NemFacade/KeyPair (see below). Whichever branch ed25519.js's runtime check picks, the
// result is now correct - and either way, none of that dependency's actual WASM-loading
// code, or bitcore-mnemonic's, ever enters the bundle.
//
// Symbol's NEM-compatibility mode (HashMode.Keccak, used by symbol-sdk's NemFacade for
// lib/nemAccount.ts / lib/nemChain.ts) swaps the RFC 8032 hash from SHA-512 to Keccak-512
// (the pre-NIST padding, i.e. @noble/hashes' `keccak_512`, not `sha3_512`) but otherwise
// follows the exact same EdDSA construction (same curve, same standard scalar clamping).
// So this builds a second EdDSA instance over the same `ed25519.Point` curve with
// `keccak_512` as the hash function, reusing @noble/curves' own `eddsa()` factory instead
// of hand-rolling curve math. Verified byte-for-byte (public key, signature, and verify)
// against symbol-sdk's own tweetnacl-based ed25519_js.js Keccak branch before wiring this
// in - same approach used to validate the Sha2_512 branch above.
function adjustScalarBytes(bytes: Uint8Array): Uint8Array {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}

const nemEd25519 = eddsa(ed25519.Point, keccak_512, { adjustScalarBytes });

export const HashMode = { Sha2_512: 0, Keccak: 1 };

function implFor(hashMode: number) {
  if (hashMode === HashMode.Keccak) return nemEd25519;
  if (hashMode === HashMode.Sha2_512) return ed25519;
  throw new Error(`Unsupported hash mode: ${hashMode} (see src/shims/symbol-crypto-wasm-node-stub.ts)`);
}

export function crypto_sign_keypair(hashMode: number, seed: Uint8Array, publicKeyOut: Uint8Array): void {
  publicKeyOut.set(implFor(hashMode).getPublicKey(seed));
}

export function crypto_private_sign(hashMode: number, privateKey: Uint8Array, message: Uint8Array, signatureOut: Uint8Array): void {
  signatureOut.set(implFor(hashMode).sign(message, privateKey));
}

export function crypto_private_verify(hashMode: number, publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  return implFor(hashMode).verify(signature, message, publicKey);
}
