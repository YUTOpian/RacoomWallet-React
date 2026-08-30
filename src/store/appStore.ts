import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import i18n from '../i18n';
import { DEFAULT_CHAIN, setNetworkMode as setChainsNetworkMode } from '../lib/chains';
import type { ChainKey, NetworkMode } from '../lib/chains';
import { setStorageNetworkMode } from '../lib/storage';
import type { TransactionWrapper } from '../lib/transactionWrapper';
import type { SwapChain, SwapToken, SwapQuote } from '../lib/uniswap';

export type AppLanguage = 'ja' | 'en';

// Ported from the Vue app's src/lib/store.ts (Vuex). NEM-era mosaic/message-encryption
// state (sendMosaics, sendMessage, usesMessageEncryption, receiverPublicKey) was already
// dropped during the EVM migration and isn't carried over here.
interface AppState {
  calculatorFormula: string;
  calculatorValue: number;
  receiverAddress: string;
  // Set by AddressBookList when opened in "pick" mode (from Send's address-book button)
  // and read back by Send once it navigates back — deliberately not persisted (see
  // partialize below), it's a one-shot handoff between those two screens only.
  pickedContactAddress: string;
  backPathFromWalletSelect: string;
  backPathFromLesson: string;
  backPathFromKey: string;
  backPathFromSendConfirmation: string;
  transaction: TransactionWrapper | null;
  // Which EVM chain (Ethereum / Polygon / Kaia) balances, sends and history apply to.
  // The active wallet's address/keys are shared across all three (see lib/chains.ts).
  activeChain: ChainKey;
  // 'mainnet' (default) or 'debug' (Sepolia / Amoy / Kairos / Fuji, plus Symbol and NEM's
  // own testnets - see lib/symbolChain.ts/lib/nemChain.ts's symbolNetworkName/
  // nemNetworkName, and lib/storage.ts's setStorageNetworkMode for the per-network wallet
  // address caching). Toggled from 設定 > テストネットモード; while 'debug' is active,
  // CHAINS/TOKEN_LISTS (EVM) and every Symbol/NEM REST call resolve to testnets only -
  // mainnet is not reachable at the same time.
  networkMode: NetworkMode;
  // UI/display language. 'ja' (default) or 'en'. Drives i18n directly (see setLanguage) -
  // kept in this persisted store, rather than only in i18next's own cache, so every other
  // piece of state that depends on it (see AppLanguage usages) can react to it the same way
  // it reacts to networkMode.
  language: AppLanguage;
  // Which token the current send flow is sending: JPYC (the primary use case), the
  // chain's native coin (ETH / POL / KAIA), or an arbitrary ERC-20 token's contract
  // address (in which case sendTokenMeta below holds its symbol/decimals/known balance).
  sendCurrency: string;
  sendTokenMeta: { address: string; symbol: string; decimals: number } | null;
  // Transaction hash of the most recently broadcast send, shown/linked on SendComplete.
  lastTxHash: string;

  // Swap flow state (SwapTop -> SwapConfirmation -> SwapComplete). Kept separate from the
  // send* fields above since a swap needs a pair of tokens plus a quote, not a single
  // currency - unlike sendCurrency/sendTokenMeta, these are intentionally NOT persisted
  // (see partialize below): a stale quote surviving a reload could go ahead at a price
  // that's no longer valid.
  swapChain: SwapChain;
  swapTokenIn: SwapToken | null;
  swapTokenOut: SwapToken | null;
  swapAmountIn: string;
  swapQuote: SwapQuote | null;
  // Slippage tolerance in basis points (100 = 1%), set on SwapTop and consumed by
  // SwapConfirmation's executeSwap call. Persisted (see partialize below) since it's a
  // standing preference, not per-swap transient state like the fields above it.
  swapSlippageBps: number;
  // Transaction hash of the most recently broadcast swap, shown/linked on SwapComplete.
  lastSwapHash: string;

  setCalculatorFormula: (value: string) => void;
  appendCalculatorFormula: (value: string) => void;
  dropCalculatorFormula: () => void;
  clearCalculatorFormula: () => void;
  setCalculatorValue: (value: number) => void;
  setReceiverAddress: (address: string) => void;
  clearReceiverAddress: () => void;
  setPickedContactAddress: (address: string) => void;
  setBackPathFromWalletSelect: (path: string) => void;
  setBackPathFromLesson: (path: string) => void;
  setBackPathFromKey: (path: string) => void;
  setBackPathFromSendConfirmation: (path: string) => void;
  setTransaction: (transaction: TransactionWrapper) => void;
  setActiveChain: (chain: ChainKey) => void;
  setNetworkMode: (mode: NetworkMode) => void;
  setLanguage: (language: AppLanguage) => void;
  setSendCurrency: (currency: string) => void;
  setSendTokenMeta: (meta: { address: string; symbol: string; decimals: number } | null) => void;
  setLastTxHash: (hash: string) => void;
  setSwapChain: (chain: SwapChain) => void;
  setSwapTokenIn: (token: SwapToken | null) => void;
  setSwapTokenOut: (token: SwapToken | null) => void;
  setSwapAmountIn: (amount: string) => void;
  setSwapQuote: (quote: SwapQuote | null) => void;
  setSwapSlippageBps: (bps: number) => void;
  setLastSwapHash: (hash: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      calculatorFormula: '0',
      calculatorValue: 0,
      receiverAddress: '',
      pickedContactAddress: '',
      backPathFromWalletSelect: '',
      backPathFromLesson: '',
      backPathFromKey: '',
      backPathFromSendConfirmation: '',
      transaction: null,
      activeChain: DEFAULT_CHAIN,
      networkMode: 'mainnet',
      language: 'ja',
      sendCurrency: 'jpyc',
      sendTokenMeta: null,
      lastTxHash: '',
      swapChain: 'ethereum',
      swapTokenIn: null,
      swapTokenOut: null,
      swapAmountIn: '0',
      swapQuote: null,
      swapSlippageBps: 100,
      lastSwapHash: '',

      setCalculatorFormula: (value) => set({ calculatorFormula: value }),
      appendCalculatorFormula: (value) => set((state) => ({
        calculatorFormula: (state.calculatorFormula === '0' && isFinite(Number(value)))
          ? value
          : state.calculatorFormula + value,
      })),
      dropCalculatorFormula: () => set((state) => ({
        calculatorFormula: state.calculatorFormula.length <= 1
          ? '0'
          : state.calculatorFormula.slice(0, -1),
      })),
      clearCalculatorFormula: () => set({ calculatorFormula: '0' }),
      setCalculatorValue: (value) => set({ calculatorValue: value }),
      setReceiverAddress: (address) => set({ receiverAddress: address }),
      clearReceiverAddress: () => set({ receiverAddress: '' }),
      setPickedContactAddress: (address) => set({ pickedContactAddress: address }),
      setBackPathFromWalletSelect: (path) => set({ backPathFromWalletSelect: path }),
      setBackPathFromLesson: (path) => set({ backPathFromLesson: path }),
      setBackPathFromKey: (path) => set({ backPathFromKey: path }),
      setBackPathFromSendConfirmation: (path) => set({ backPathFromSendConfirmation: path }),
      setTransaction: (transaction) => set({ transaction }),
      setActiveChain: (chain) => set({ activeChain: chain }),
      setNetworkMode: (mode) => {
        setChainsNetworkMode(mode);
        setStorageNetworkMode(mode);
        set({ networkMode: mode });
      },
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      setSendCurrency: (currency) => set({ sendCurrency: currency }),
      setSendTokenMeta: (meta) => set({ sendTokenMeta: meta }),
      setLastTxHash: (hash) => set({ lastTxHash: hash }),
      setSwapChain: (chain) => set({ swapChain: chain }),
      setSwapTokenIn: (token) => set({ swapTokenIn: token }),
      setSwapTokenOut: (token) => set({ swapTokenOut: token }),
      setSwapAmountIn: (amount) => set({ swapAmountIn: amount }),
      setSwapQuote: (quote) => set({ swapQuote: quote }),
      setSwapSlippageBps: (bps) => set({ swapSlippageBps: bps }),
      setLastSwapHash: (hash) => set({ lastSwapHash: hash }),
    }),
    {
      name: 'raccoon-wallet-app-store',
      storage: createJSONStorage(() => localStorage),
      // transaction/calculator state is transient per-session; only persist what the
      // Vuex version persisted via vuex-persistedstate (everything except the live
      // in-progress transaction object, which doesn't need to survive a reload).
      partialize: (state) => ({
        activeChain: state.activeChain,
        networkMode: state.networkMode,
        language: state.language,
        sendCurrency: state.sendCurrency,
        swapSlippageBps: state.swapSlippageBps,
      }),
      // localStorage is the single source of truth for networkMode/language, but chains.ts,
      // storage.ts and i18next each keep their own module-level copy (so plain
      // functions/components that aren't reading this store directly still see the right
      // value). Sync all three once the persisted values are loaded, so a reload doesn't
      // silently fall back to mainnet chains/addresses or Japanese.
      onRehydrateStorage: () => (state) => {
        if (state?.networkMode) {
          setChainsNetworkMode(state.networkMode);
          setStorageNetworkMode(state.networkMode);
        }
        if (state?.language) {
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
