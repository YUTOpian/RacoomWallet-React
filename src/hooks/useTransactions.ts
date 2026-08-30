import { useState, useCallback } from 'react';
import { TransactionWrapper } from '../lib/transactionWrapper';
import { WalletsHelper } from '../lib/storage';
import { fetchRecentJpycTransfers, getBlockTimestamp } from '../lib/chains';
import type { ChainKey } from '../lib/chains';

// Every EVM chain the wallet supports; history is fetched from all of them and merged so
// Home/TransactionList show one combined, chronologically-sorted feed regardless of which
// chain each transfer happened on.
const ALL_CHAINS: ChainKey[] = ['ethereum', 'polygon', 'kaia', 'avalanche'];

// Ported from src/components/mixins/TransactionModule.ts.
//
// Real transaction history is read straight from public RPC logs (see
// chains.ts:fetchRecentJpycTransfers) rather than a paid explorer/indexer API — see the
// comment above that function for the JPYC-only trade-off this implies. Unconfirmed
// (pending/mempool) transactions aren't observable this way either, so that list always
// resolves empty; only confirmed history is populated.
export function useTransactions() {
  const [confirmedTransactions, setConfirmedTransactions] = useState<TransactionWrapper[]>([]);
  const [unconfirmedTransactions, setUnconfirmedTransactions] = useState<TransactionWrapper[]>([]);

  const fetchTransactions = useCallback(async (
    count: number = 10,
    _withUnconfirmedTransactions: boolean = false,
    onFetched: (confirmed: TransactionWrapper[], unconfirmed: TransactionWrapper[]) => void = () => {}
  ) => {
    const activeWallet = await WalletsHelper.getActive();
    if (activeWallet == null) {
      setConfirmedTransactions([]);
      setUnconfirmedTransactions([]);
      onFetched([], []);
      return;
    }

    // Ask each chain for up to `count` of its own most-recent transfers. Over-fetching per
    // chain (rather than count/3 each) means a wallet that's only active on one chain still
    // ends up with a full, correctly-sorted `count`-sized merged list.
    const perChainResults = await Promise.all(ALL_CHAINS.map(async (chain) => {
      try {
        return await fetchRecentJpycTransfers(chain, activeWallet.address, count);
      } catch (e) {
        console.warn(`Failed to load ${chain} JPYC transfer history`, e);
        return [];
      }
    }));

    const flat = perChainResults.flat();

    // Block height isn't comparable across chains (different block times), so resolve each
    // transfer's real-world time before merging/sorting. Bounded to one getBlock per
    // transfer actually found (already capped to `count` per chain above), not per log
    // scanned.
    const withTimestamps = await Promise.all(flat.map(async (transfer) => ({
      transfer,
      timestamp: await getBlockTimestamp(transfer.chain, transfer.blockNumber).catch(() => 0),
    })));

    withTimestamps.sort((a, b) => b.timestamp - a.timestamp);

    const merged = withTimestamps.slice(0, count).map(({ transfer, timestamp }) => new TransactionWrapper({
      hash: transfer.hash,
      timestamp: new Date(timestamp * 1000),
      isReception: transfer.isReception,
      isConfirmed: true,
      senderAddress: transfer.senderAddress,
      receiverAddress: transfer.receiverAddress,
      amount: transfer.amount,
      currencySymbol: transfer.currencySymbol,
      // Fee isn't in a Transfer log — reading it would need an extra getTransactionReceipt
      // call per row. Left unfetched here since list/home views don't render fee; see
      // TransactionDetail for a per-transaction fee lookup.
      feeAmount: '0',
      chain: transfer.chain,
    }));

    setConfirmedTransactions(merged);
    setUnconfirmedTransactions([]);
    onFetched(merged, []);
  }, []);

  return { confirmedTransactions, unconfirmedTransactions, fetchTransactions };
}
