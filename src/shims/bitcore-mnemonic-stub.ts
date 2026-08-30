// Stub for the 'bitcore-mnemonic' package, aliased in vite.config.ts.
//
// symbol-sdk's root index.js unconditionally imports Bip32.js, which imports
// 'bitcore-mnemonic' to convert a mnemonic phrase to a BIP39 seed. This app never calls
// that class - lib/symbolAccount.ts derives the Symbol account by hand instead (using
// ethers' Mnemonic.computeSeed() + @noble/hashes), specifically to avoid pulling
// bitcore-mnemonic's large legacy dependency tree (bitcore-lib, elliptic, asn1.js, and
// their own Node builtin requirements) into the browser bundle. Aliasing it to this
// stub keeps symbol-sdk's import graph resolvable without ever loading that tree, or
// needing to polyfill the Node builtins (util/vm/stream) it would otherwise require.
//
// If this ever actually runs, something changed upstream in symbol-sdk to call Bip32
// for real - the error below is intentionally loud rather than silently misbehaving.
export default class UnusedBitcoreMnemonicStub {
  constructor() {
    throw new Error('bitcore-mnemonic is stubbed out in this build; use lib/symbolAccount.ts instead.');
  }
}
