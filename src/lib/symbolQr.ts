import { Address as SymbolAddressType } from 'symbol-sdk/symbol';
import { symbolNetworkName } from './symbolChain';

/**
 * Symbol's standard QR code schema (symbol/qr-library's "ExportAddress" type), the format
 * real Symbol wallets (mobile app, desktop wallet, etc.) generate and expect to scan for
 * an address-only QR - a bare address string is not enough; wallets that follow this
 * schema won't recognize it. Schema: { v, type, network_id, chain_id, data: { name,
 * address } }. Reference: https://github.com/symbol/qr-library (QRCodeType.ExportAddress = 7).
 */

// Symbol mainnet's generation hash (a.k.a. nemesis block hash) - a network-wide constant
// that never changes, documented at https://docs.symbol.dev/guides/network/running-a-secure-symbol-node.html.
export const SYMBOL_MAINNET_GENERATION_HASH = '57F7DA205008026C776CB6AED843393F04CD458E0AA2D9F1D5F31A402072B2D6';
export const SYMBOL_MAINNET_NETWORK_ID = 104;
// Symbol testnet's generation hash/network id (relaunched 2022) - source: symbol-sdk's
// Network.js TESTNET definition (see lib/symbolChain.ts's TESTNET_EPOCH_MS comment for the
// same relaunch). 0x98 (testnet's network identifier byte) = 152 decimal.
export const SYMBOL_TESTNET_GENERATION_HASH = '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4';
export const SYMBOL_TESTNET_NETWORK_ID = 152;
const QR_SCHEMA_VERSION = 3;
const QR_TYPE_EXPORT_ADDRESS = 7;

interface AddressQrPayload {
  v: number;
  type: number;
  network_id: number;
  chain_id: string;
  data: { name: string; address: string };
}

export function buildAddressQrPayload(name: string, address: string): string {
  const isTestnet = symbolNetworkName() === 'testnet';
  const payload: AddressQrPayload = {
    v: QR_SCHEMA_VERSION,
    type: QR_TYPE_EXPORT_ADDRESS,
    network_id: isTestnet ? SYMBOL_TESTNET_NETWORK_ID : SYMBOL_MAINNET_NETWORK_ID,
    chain_id: isTestnet ? SYMBOL_TESTNET_GENERATION_HASH : SYMBOL_MAINNET_GENERATION_HASH,
    data: { name, address },
  };
  return JSON.stringify(payload);
}

export function isValidSymbolAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new SymbolAddressType(address);
    // Symbol addresses encode the network in their first character - 'N' for mainnet, 'T'
    // for testnet - so which prefix counts as valid follows 設定 > テストネットモード the same
    // way node selection and account derivation do (see lib/symbolChain.ts's
    // symbolNetworkName), rather than only ever accepting mainnet addresses.
    return address.startsWith(symbolNetworkName() === 'testnet' ? 'T' : 'N');
  } catch {
    return false;
  }
}

/**
 * Extracts a Symbol address from a scanned QR value. Accepts the standard ExportAddress
 * JSON schema (what this app's own Receive screen and other Symbol wallets generate),
 * falling back to a bare address (optionally dash-grouped, or prefixed with "symbol:")
 * for QR codes that only carry the address itself.
 */
export function extractSymbolAddressFromQr(decoded: string): string | null {
  try {
    const parsed = JSON.parse(decoded);
    if (parsed?.type === QR_TYPE_EXPORT_ADDRESS && typeof parsed?.data?.address === 'string') {
      const address = parsed.data.address.toUpperCase();
      return isValidSymbolAddress(address) ? address : null;
    }
  } catch {
    // Not JSON - fall through to bare-address handling below.
  }

  const cleaned = decoded.replace(/^symbol:/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return isValidSymbolAddress(cleaned) ? cleaned : null;
}
