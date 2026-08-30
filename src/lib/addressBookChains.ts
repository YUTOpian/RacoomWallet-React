import { ethers } from 'ethers';
import type { ChainKey } from './chains';
import { CHAIN_ICONS } from './chainIcons';
import { isValidSymbolAddress } from './symbolQr';
import { isValidNemAddress } from './nemQr';
import iconSymbol from '../assets/icon_chain_symbol.png';
import iconNem from '../assets/icon_chain_nem.png';

// The address book's chain picker needs Symbol (XYM) alongside the app's real EVM chains
// (see lib/chains.ts's ChainKey), even though Symbol isn't one of the balance-fetching
// chains those types/configs describe - it uses a completely different address format
// (ed25519-derived, base32-encoded, no '0x' prefix) and has no RPC/JPYC/chainId config of
// its own here. Kept as its own union rather than folded into ChainKey so nothing in
// Balance/Send/Swap (which assume every ChainKey is an EVM chain with RPC endpoints) has
// to account for a chain that doesn't fit that shape.
export type AddressBookChainKey = ChainKey | 'symbol' | 'nem';

export const ADDRESS_BOOK_CHAIN_ORDER: AddressBookChainKey[] = ['ethereum', 'polygon', 'kaia', 'avalanche', 'symbol', 'nem'];

export const ADDRESS_BOOK_CHAIN_NAMES: Record<AddressBookChainKey, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  kaia: 'Kaia',
  avalanche: 'Avalanche',
  symbol: 'Symbol',
  nem: 'NEM',
};

export const ADDRESS_BOOK_CHAIN_ICONS: Record<AddressBookChainKey, string> = {
  ...CHAIN_ICONS,
  symbol: iconSymbol,
  nem: iconNem,
};

export function isValidAddressForChain(chain: AddressBookChainKey, address: string): boolean {
  // Reuses the same Symbol/NEM address checks as their respective Send screens
  // (lib/symbolQr.ts and lib/nemQr.ts, both backed by symbol-sdk's own Address classes)
  // rather than second hand-rolled ones, so "valid Symbol/NEM address" means exactly the
  // same thing everywhere in the app.
  if (chain === 'symbol') return isValidSymbolAddress(address.trim().toUpperCase().replace(/-/g, ''));
  if (chain === 'nem') return isValidNemAddress(address.trim().toUpperCase().replace(/-/g, ''));
  return ethers.isAddress(address.trim());
}

// Normalizes a Symbol/NEM address to its canonical unhyphenated uppercase form before
// saving, same as EVM addresses are trimmed - so two entries of "the same" address (typed
// with or without hyphens) don't end up looking different in storage.
export function normalizeAddressForChain(chain: AddressBookChainKey, address: string): string {
  return chain === 'symbol' || chain === 'nem' ? address.trim().toUpperCase().replace(/-/g, '') : address.trim();
}
