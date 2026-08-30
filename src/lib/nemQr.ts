import { Address as NemAddressType } from 'symbol-sdk/nem';
import { InvoiceData } from './invoiceData';
import { nemNetworkName } from './nemChain';

/**
 * NEM's own classic QR schema (the same {v, type, data: {addr, amount, msg}} shape as
 * lib/invoiceData.ts, ported 1:1 from the original NEM Vue app's QR lab) rather than
 * Symbol's ExportAddress schema (lib/symbolQr.ts) - real NEM wallets (and this app's own
 * original NEM-era QR lab) generate and expect exactly this format for an address/contact
 * QR, so reusing it here (type 2 = "add contact", amount 0) is what makes this Receive
 * screen's QR scannable by an actual NEM wallet, not just by this app's own Scan screen.
 */

export function buildAddressQrPayload(_name: string, address: string): string {
  // InvoiceData's wire format has a "name" field, but the ported class (see
  // lib/invoiceData.ts) always writes it empty - kept as a parameter here anyway (unused)
  // so this function's signature matches lib/symbolQr.ts's buildAddressQrPayload, which
  // callers (Receive.tsx, NemReceive.tsx) call interchangeably by chain.
  const invoice = new InvoiceData(address, 0, '', 2);
  return invoice.toJsonString();
}

export function isValidNemAddress(address: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new NemAddressType(address);
    // NEM addresses encode the network in their first character - 'N' for mainnet, 'T'
    // for testnet - so which prefix counts as valid follows 設定 > テストネットモード the same
    // way node selection and account derivation do (see lib/nemChain.ts's
    // nemNetworkName), rather than only ever accepting mainnet addresses.
    return address.startsWith(nemNetworkName() === 'testnet' ? 'T' : 'N');
  } catch {
    return false;
  }
}

/**
 * Extracts a NEM address from a scanned QR value. Accepts the classic InvoiceData JSON
 * schema (type 1 invoice or type 2 contact - what this app's own Receive screen and other
 * NEM wallets generate), falling back to a bare address (optionally dash-grouped, or
 * prefixed with "nem:") for QR codes that only carry the address itself.
 */
export function extractNemAddressFromQr(decoded: string): string | null {
  const invoice = InvoiceData.fromJsonString(decoded);
  if (invoice !== null) {
    const address = invoice.address.toUpperCase();
    if (isValidNemAddress(address)) return address;
  }

  const cleaned = decoded.replace(/^nem:/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return isValidNemAddress(cleaned) ? cleaned : null;
}
