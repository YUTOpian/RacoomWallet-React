import { useState, useCallback } from 'react';
import { CHAINS } from '../lib/chains';
import type { ChainKey, ChainConfig } from '../lib/chains';
import { fetchBalances, fetchNativeJpyRate } from '../lib/chains';
import { WalletsHelper } from '../lib/storage';
import { useAppStore } from '../store/appStore';

// Ported from src/components/mixins/EvmBalanceModule.ts.
export function useEvmBalance() {
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;
  const networkMode = useAppStore((s) => s.networkMode);
  const setActiveChainInStore = useAppStore((s) => s.setActiveChain);
  const [nativeBalance, setNativeBalance] = useState('0');
  const [jpycBalance, setJpycBalance] = useState('0');
  // Native balance + JPYC balance, both converted to JPY and summed — the single
  // "total assets" figure shown on the Home screen's Balance card.
  const [totalJpyBalance, setTotalJpyBalance] = useState(0);

  const activeChainConfig: ChainConfig = CHAINS[activeChain];

  const fetchEvmBalance = useCallback(async () => {
    const activeWallet = await WalletsHelper.getActive();
    if (activeWallet == null) {
      setNativeBalance('0');
      setJpycBalance('0');
      setTotalJpyBalance(0);
      return;
    }
    try {
      const [balances, jpyRate] = await Promise.all([
        fetchBalances(activeChain, activeWallet.address),
        fetchNativeJpyRate(activeChain),
      ]);
      setNativeBalance(balances.native);
      setJpycBalance(balances.jpyc);
      // JPYC is JPY-pegged 1:1, so it's added as-is; the native coin is converted using
      // the fetched rate (0 if the rate fetch failed, so it just doesn't contribute).
      setTotalJpyBalance(Number(balances.jpyc) + Number(balances.native) * jpyRate);
    } catch (e) {
      // Keep the previous values on a transient RPC failure rather than flashing to zero.
      console.error('Failed to fetch balances', e);
    }
    // networkMode is included so toggling debug mode (mainnet <-> testnets) gives this
    // callback a new identity, causing any effect keyed on it (e.g. Home's `update`) to
    // refetch against the newly active network instead of showing stale balances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChain, networkMode]);

  const setActiveChain = useCallback((chain: ChainKey) => {
    setActiveChainInStore(chain);
  }, [setActiveChainInStore]);

  return { nativeBalance, jpycBalance, totalJpyBalance, activeChain, activeChainConfig, fetchEvmBalance, setActiveChain };
}
