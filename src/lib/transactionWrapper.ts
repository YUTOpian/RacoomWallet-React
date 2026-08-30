import type { ChainKey } from './chains';

/**
 * A single JPYC/native-coin transfer, shaped for display in TransactionList/TransactionDetail.
 *
 * This intentionally has no NEM-era concepts (encrypted messages, mosaics, multisig
 * cosignatories) — ERC-20/native EVM transfers don't have any of those. History (JPYC
 * transfers, read directly from public RPC logs — see chains.ts's fetchRecentJpycTransfers)
 * is now wired up; `chain` records which network a given entry came from so mixed
 * multi-chain lists (Home, TransactionList) can label/link each row correctly.
 */
export class TransactionWrapper {
  readonly hash: string;
  readonly dateString: string;
  readonly timeString: string;
  readonly isReception: boolean;
  readonly isConfirmed: boolean;
  readonly senderAddress: string;
  readonly receiverAddress: string;
  readonly amount: string;    // formatted, e.g. "1000.0"
  readonly currencySymbol: string; // "JPYC", "ETH", "POL", "KAIA"
  readonly feeAmount: string; // formatted native-coin gas fee
  readonly chain?: ChainKey;  // which network this transfer happened on, when known

  get peer(): string {
    return this.isReception ? this.senderAddress : this.receiverAddress;
  }

  constructor(params: {
    hash: string;
    timestamp: Date;
    isReception: boolean;
    isConfirmed: boolean;
    senderAddress: string;
    receiverAddress: string;
    amount: string;
    currencySymbol: string;
    feeAmount: string;
    chain?: ChainKey;
  }) {
    this.hash = params.hash;
    this.dateString = params.timestamp.toLocaleDateString();
    this.timeString = params.timestamp.toLocaleTimeString();
    this.isReception = params.isReception;
    this.isConfirmed = params.isConfirmed;
    this.senderAddress = params.senderAddress;
    this.receiverAddress = params.receiverAddress;
    this.amount = params.amount;
    this.currencySymbol = params.currencySymbol;
    this.feeAmount = params.feeAmount;
    this.chain = params.chain;
  }
}
