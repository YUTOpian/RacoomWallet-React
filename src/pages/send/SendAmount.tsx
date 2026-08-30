import { useEffect, useState } from 'react';
import { Avatar, Box, Menu, MenuItem, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import Calculator from '../../components/Calculator';
import { CHAINS, fetchBalances, fetchTokenBalances } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { getTokenIcon } from '../../lib/tokenIcons';
import { WalletsHelper, CustomTokensHelper } from '../../lib/storage';
import { useAppStore } from '../../store/appStore';
import heroSendSmall from '../../assets/heroimage_send_small.png';

// Same rounded "grey card" look as the chain/token pickers on the Swap screen (see
// pages/swap/SwapTop.tsx's CARD_SX) - reused here so the two chain-then-token pickers this
// screen now uses look like one consistent pattern across the app, not a one-off.
const CARD_SX = { bgcolor: 'grey.100', borderRadius: 5, px: 2, py: 1.5 } as const;

// One selectable entry in the asset dropdown below: a chain's native coin, its JPYC, or
// one of its ERC-20 tokens (curated or custom-added). `key` uniquely identifies the entry
// across every chain at once ("ethereum|jpyc", "polygon|native", "kaia|0xAbc...") so the
// same dropdown can mix chains - "ABCトークン (Ethereum)" next to "RRRトークン (Polygon)" -
// without the person needing to switch chains first to find an asset.
interface AssetOption {
  key: string;
  chain: ChainKey;
  currency: 'native' | 'jpyc' | 'token';
  symbol: string;
  balance: string;
  tokenMeta: { address: string; symbol: string; decimals: number } | null;
}

const optionKey = (chain: ChainKey, currency: string) => `${chain}|${currency}`;

export default function SendAmount() {
  const { t } = useTranslation();
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;
  const sendCurrency = useAppStore((s) => s.sendCurrency);
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const setSendCurrency = useAppStore((s) => s.setSendCurrency);
  const setSendTokenMeta = useAppStore((s) => s.setSendTokenMeta);

  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Anchor elements for the two pill dropdowns below (chain, then token) - same pattern as
  // the chain/token pickers on the Swap screen (see pages/swap/SwapTop.tsx).
  const [chainMenuAnchor, setChainMenuAnchor] = useState<null | HTMLElement>(null);
  const [tokenMenuAnchor, setTokenMenuAnchor] = useState<null | HTMLElement>(null);

  // Every asset the active wallet actually holds, across every chain at once - not just
  // whichever chain happens to be active - so the dropdown can offer chain-mixed choices.
  useEffect(() => {
    (async () => {
      setLoadingOptions(true);
      const activeWallet = await WalletsHelper.getActive();
      if (activeWallet == null) {
        setAssetOptions([]);
        setLoadingOptions(false);
        return;
      }
      try {
        const chains = Object.keys(CHAINS) as ChainKey[];
        const perChain = await Promise.all(chains.map(async (chain): Promise<AssetOption[]> => {
          const customTokens = await CustomTokensHelper.list(chain);
          const [balances, tokens] = await Promise.all([
            fetchBalances(chain, activeWallet.address),
            fetchTokenBalances(chain, activeWallet.address, customTokens),
          ]);
          return [
            { key: optionKey(chain, 'jpyc'), chain, currency: 'jpyc', symbol: 'JPYC', balance: balances.jpyc, tokenMeta: null },
            { key: optionKey(chain, 'native'), chain, currency: 'native', symbol: CHAINS[chain].nativeCurrency.symbol, balance: balances.native, tokenMeta: null },
            ...tokens.map((token): AssetOption => ({
              key: optionKey(chain, token.address),
              chain,
              currency: 'token',
              symbol: token.symbol,
              balance: token.balance,
              tokenMeta: { address: token.address, symbol: token.symbol, decimals: token.decimals },
            })),
          ];
        }));
        setAssetOptions(perChain.flat());
      } catch (e) {
        console.error('Failed to load asset options', e);
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, []);

  // The currently-selected asset is derived from the store (activeChain + sendCurrency),
  // rather than kept as separate local state, so a token pre-selected on the Token screen
  // (see pages/detail/Balance.tsx's onSendToken) shows up already selected here too.
  const selectedKey = optionKey(activeChain, sendCurrency);
  const selectedOption = assetOptions.find((o) => o.key === selectedKey) ?? null;
  const currencyLabel = selectedOption?.symbol ?? '';
  const availableBalance = selectedOption?.balance ?? '0.0';

  // Only this chain's assets - the token picker below is scoped to whichever chain is
  // currently selected, matching the two-step "chain, then token" flow requested (rather
  // than the old single dropdown mixing every chain's assets at once).
  const chainKeys = Object.keys(CHAINS) as ChainKey[];
  const tokenOptionsForChain = assetOptions.filter((o) => o.chain === activeChain);

  // Logo for an asset pill: the chain's own logo for its native coin, a curated logo for
  // JPYC/USDT/USDC, or null - callers fall back to a plain letter avatar for anything else
  // (e.g. an unrecognized custom token), same idea as SwapTop's tokenIcon helper.
  const assetIcon = (option: AssetOption | null): string | null => {
    if (!option) return null;
    if (option.currency === 'native') return CHAIN_ICONS[option.chain];
    return getTokenIcon(option.symbol);
  };

  const onSelectAsset = (key: string) => {
    const option = assetOptions.find((o) => o.key === key);
    if (!option) return;
    setActiveChain(option.chain);
    if (option.currency === 'token' && option.tokenMeta) {
      setSendCurrency(option.tokenMeta.address);
      setSendTokenMeta(option.tokenMeta);
    } else {
      setSendCurrency(option.currency);
      setSendTokenMeta(null);
    }
  };

  // Switching chains keeps the same *kind* of asset selected when the new chain has one
  // (e.g. staying on JPYC when moving from Ethereum to Polygon), falls back to that chain's
  // JPYC, and otherwise just picks whatever that chain offers first - so the token picker
  // is never left pointing at an asset that belongs to the chain you just left.
  const onSelectChain = (chain: ChainKey) => {
    setChainMenuAnchor(null);
    if (chain === activeChain) return;
    const optionsForNewChain = assetOptions.filter((o) => o.chain === chain);
    const sameKind = optionsForNewChain.find(
      (o) => o.currency === selectedOption?.currency && o.symbol === selectedOption?.symbol
    );
    const next = sameKind ?? optionsForNewChain.find((o) => o.currency === 'jpyc') ?? optionsForNewChain[0] ?? null;
    setActiveChain(chain);
    if (next) {
      if (next.currency === 'token' && next.tokenMeta) {
        setSendCurrency(next.tokenMeta.address);
        setSendTokenMeta(next.tokenMeta);
      } else {
        setSendCurrency(next.currency);
        setSendTokenMeta(null);
      }
    } else {
      setSendCurrency('jpyc');
      setSendTokenMeta(null);
    }
  };

  return (
    <Box sx={{ height: '100%' }}>
      <AppToolBar back="/top?tab=send" title={t('qrlab.amount_title')} />
      <WalletBar isOpened={false} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box component="img" src={heroSendSmall} sx={{ width: '100%' }} />

        {/* Step 1: チェーン - pick the network first. Picking a new chain re-derives the
            token selection below (see onSelectChain) rather than leaving it pointing at an
            asset that no longer belongs to the active chain. */}
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('send.chain_label')}</Typography>
          <Box
            onClick={(e) => setChainMenuAnchor(e.currentTarget)}
            sx={{ ...CARD_SX, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar src={CHAIN_ICONS[activeChain]} sx={{ width: 32, height: 32 }} />
              <Typography sx={{ fontWeight: 'bold' }}>{CHAINS[activeChain].name}</Typography>
            </Box>
            <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
          </Box>
          <Menu anchorEl={chainMenuAnchor} open={!!chainMenuAnchor} onClose={() => setChainMenuAnchor(null)}>
            {chainKeys.map((key) => (
              <MenuItem key={key} selected={key === activeChain} onClick={() => onSelectChain(key)}>
                <Avatar src={CHAIN_ICONS[key]} sx={{ width: 24, height: 24, mr: 1.5 }} />
                {CHAINS[key].name}
              </MenuItem>
            ))}
          </Menu>
        </Box>

        {/* Step 2: トークン - pick which asset on that chain to send (scoped to the chain
            chosen above). */}
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('send.token_label')}</Typography>
          <Box
            onClick={(e) => tokenOptionsForChain.length > 0 && setTokenMenuAnchor(e.currentTarget)}
            sx={{
              ...CARD_SX, display: 'inline-flex', alignItems: 'center', gap: 1,
              cursor: tokenOptionsForChain.length > 0 ? 'pointer' : 'default',
            }}
          >
            <Avatar src={assetIcon(selectedOption) ?? undefined} sx={{ width: 24, height: 24, fontSize: 12 }}>
              {currencyLabel.charAt(0)}
            </Avatar>
            <Typography sx={{ fontWeight: 'bold' }}>
              {loadingOptions ? 'Loading...' : (currencyLabel || t('send.select_token'))}
            </Typography>
            <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Box>
          <Menu anchorEl={tokenMenuAnchor} open={!!tokenMenuAnchor} onClose={() => setTokenMenuAnchor(null)}>
            {tokenOptionsForChain.map((option) => (
              <MenuItem
                key={option.key}
                selected={option.key === selectedKey}
                onClick={() => { onSelectAsset(option.key); setTokenMenuAnchor(null); }}
              >
                <Avatar src={assetIcon(option) ?? undefined} sx={{ width: 24, height: 24, mr: 1.5, fontSize: 12 }}>
                  {option.symbol.charAt(0)}
                </Avatar>
                {option.symbol}
              </MenuItem>
            ))}
            {tokenOptionsForChain.length === 0 && <MenuItem disabled>{t('send.select_token')}</MenuItem>}
          </Menu>
        </Box>

        {/* Step 3: 金額 - the amount entered via the keypad below, for the token picked
            above. */}
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: 'primary.main' }}>{t('common.amount')}</Typography>
          <Typography sx={{ fontSize: 'x-large' }}>{calculatorFormula} {currencyLabel}</Typography>
          <Typography sx={{ color: '#929292', fontSize: 12 }}>
            {t('send.available_balance')}: {availableBalance} {currencyLabel}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ position: 'sticky', bottom: 0 }}>
        <Calculator to="/send/confirmation" />
      </Box>
    </Box>
  );
}
