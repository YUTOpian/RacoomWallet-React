import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Card, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, IconButton, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RaccoonAppBar from '../../components/RaccoonAppBar';
import WalletBar from '../../components/WalletBar';
import BottomNav from '../../components/BottomNav';
import { CHAINS, fetchBalances, fetchNativeJpyRate, fetchTokenBalances, fetchTokenMetadata } from '../../lib/chains';
import type { ChainKey, Balances, TokenBalance } from '../../lib/chains';
import { WalletsHelper, CustomTokensHelper } from '../../lib/storage';
import { fetchSymbolBalance } from '../../lib/symbolChain';
import { useAppStore } from '../../store/appStore';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import iconSymbol from '../../assets/icon_chain_symbol.png';
import balanceBackground from '../../assets/image_home_balance_background.png';
import heroTokenSmall from '../../assets/heroimage_token_small.png';

// Symbol's brand violet - the same swatch used across the Symbol section (SymbolTop,
// SymbolSend, SymbolReceive) so this card's accents read as "that same Symbol identity"
// rather than an unrelated color choice.
const SYMBOL_VIOLET = '#8239DD';

type ChainBalanceState = Balances & { jpyRate: number; tokens: TokenBalance[] };

export default function Balance() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setActiveChain = useAppStore((s) => s.setActiveChain);
  const setSendCurrency = useAppStore((s) => s.setSendCurrency);
  const setSendTokenMeta = useAppStore((s) => s.setSendTokenMeta);
  const clearReceiverAddress = useAppStore((s) => s.clearReceiverAddress);
  // Re-read on every render (not hoisted to module scope) so a debug-mode toggle is
  // reflected immediately next time this screen renders, instead of being frozen at
  // whatever CHAINS resolved to the first time this module was loaded.
  const networkMode = useAppStore((s) => s.networkMode);
  const chains = Object.keys(CHAINS).map((key) => CHAINS[key as ChainKey]);

  const [loading, setLoading] = useState(true);
  // Every chain's balance (native + JPYC + any known ERC-20 token held, plus tokens the
  // person registered by hand below), fetched and shown together - no network picker
  // gating what's visible.
  const [balances, setBalances] = useState<Record<ChainKey, ChainBalanceState>>({} as Record<ChainKey, ChainBalanceState>);
  // Contract addresses (lowercased) the person has manually registered per chain, so the
  // token rows below know which ones to offer a remove button on.
  const [customAddresses, setCustomAddresses] = useState<Record<ChainKey, Set<string>>>({} as Record<ChainKey, Set<string>>);
  // XYM balance, shown as its own card below the EVM chains - but only once this wallet
  // has derived its Symbol account (visited /symbol and unlocked it with the PIN, so
  // there's actually an address to check) *and* that balance isn't zero. null covers
  // both "not applicable" cases at once, so the card below just checks for null.
  const [symbolBalance, setSymbolBalance] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const activeWallet = await WalletsHelper.getActive();
    if (activeWallet == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [entries, symbolResult] = await Promise.all([
        Promise.all(chains.map(async (chain) => {
          const customTokens = await CustomTokensHelper.list(chain.key);
          const [chainBalances, jpyRate, tokens] = await Promise.all([
            fetchBalances(chain.key, activeWallet.address),
            fetchNativeJpyRate(chain.key),
            fetchTokenBalances(chain.key, activeWallet.address, customTokens),
          ]);
          return {
            key: chain.key,
            balance: { ...chainBalances, jpyRate, tokens } as ChainBalanceState,
            customSet: new Set(customTokens.map((t) => t.address.toLowerCase())),
          };
        })),
        (async () => {
          if (!activeWallet.symbolAddress) return null;
          try {
            const b = await fetchSymbolBalance(activeWallet.symbolAddress);
            return Number(b) !== 0 ? b : null;
          } catch (e) {
            console.error('Failed to fetch Symbol balance', e);
            return null;
          }
        })(),
      ]);
      setBalances(Object.fromEntries(entries.map((e) => [e.key, e.balance])) as Record<ChainKey, ChainBalanceState>);
      setCustomAddresses(Object.fromEntries(entries.map((e) => [e.key, e.customSet])) as Record<ChainKey, Set<string>>);
      setSymbolBalance(symbolResult);
    } catch (e) {
      console.error('Failed to fetch balances', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkMode]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Jumps into the destination-entry step (the Send tab) rather than straight into
  // /send/amount - receiverAddress is only ever set there (see pages/top/Send.tsx), so
  // skipping it left the previous/empty address in place and produced an
  // "invalid hexlify value" on estimateGas once send actually tried to broadcast to "".
  // Clearing it first also stops a stale address from a previous send silently carrying
  // over to this one.
  const onSendJpycOrNative = (chain: ChainKey, currency: 'jpyc' | 'native') => {
    setActiveChain(chain);
    setSendCurrency(currency);
    setSendTokenMeta(null);
    clearReceiverAddress();
    navigate('/top?tab=send');
  };

  const onSendToken = (chain: ChainKey, token: TokenBalance) => {
    setActiveChain(chain);
    setSendCurrency(token.address);
    setSendTokenMeta({ address: token.address, symbol: token.symbol, decimals: token.decimals });
    clearReceiverAddress();
    navigate('/top?tab=send');
  };

  // Symbol isn't part of the EVM chain/currency scheme the store tracks (activeChain/
  // sendCurrency/sendTokenMeta), so there's nothing chain-specific to preselect here -
  // but the flow itself mirrors the EVM tokens above: land on the SEND tab so the person
  // enters a destination address there. Once they type a Symbol address, Send.tsx (see
  // pages/top/Send.tsx) recognizes it and routes into the Symbol numpad/send screens on
  // its own - this button doesn't jump straight to /symbol/send.
  const onSendSymbol = () => {
    clearReceiverAddress();
    navigate('/top?tab=send');
  };

  // --- Add-custom-token dialog --------------------------------------------------------
  //
  // JPYC/USDT/native/USDC etc. come from the curated list in lib/chains.ts, so any other
  // token (a new airdrop, a niche project, something region-specific) simply never shows
  // up - there's no way to ask a plain RPC node "list every token this address holds"
  // without a paid indexer. This dialog lets the person register one by hand. It's always
  // opened from a specific chain's card, so the chain is fixed to whichever card the
  // "Add token" button was tapped on (shown, not chosen) - only the contract address
  // needs typing. It's read directly from the contract (see fetchTokenMetadata) and saved
  // so it keeps showing up here.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formChain, setFormChain] = useState<ChainKey>(chains[0].key);
  const [formAddress, setFormAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openDialog = (chain: ChainKey) => {
    setFormChain(chain);
    setFormAddress('');
    setFormError(null);
    setDialogOpen(true);
  };
  const closeDialog = () => {
    if (submitting) return;
    setDialogOpen(false);
  };

  const onSubmitToken = async () => {
    const address = formAddress.trim();
    if (address.length === 0) {
      setFormError(t('balance.error_empty_address'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (activeWallet == null) {
        setFormError(t('balance.error_no_wallet'));
        return;
      }
      const meta = await fetchTokenMetadata(formChain, address);
      await CustomTokensHelper.add({ chain: formChain, ...meta });
      setDialogOpen(false);
      await fetchAll();
    } catch (e) {
      console.error('Failed to add custom token', e);
      setFormError(t('balance.error_fetch_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onRemoveToken = async (chain: ChainKey, token: TokenBalance) => {
    await CustomTokensHelper.remove(chain, token.address);
    await fetchAll();
  };

  const isCustomToken = useMemo(
    () => (chain: ChainKey, token: TokenBalance) => customAddresses[chain]?.has(token.address.toLowerCase()) ?? false,
    [customAddresses],
  );

  return (
    <Box sx={{ width: '100vw', pb: 7 }}>
      <RaccoonAppBar />
      <WalletBar isOpened={false} />
      <Box component="img" src={heroTokenSmall} alt="" sx={{ width: '100%', display: 'block' }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ px: 2, mt: 5, display: 'flex', flexDirection: 'column', gap: 2, pb: 4 }}>
          {chains.map((chain) => {
            const balance = balances[chain.key];
            return (
              <Card key={chain.key}>
                <Box sx={{ px: 2, pt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="img" src={CHAIN_ICONS[chain.key]} sx={{ width: 20, height: 20, borderRadius: '50%' }} />
                  <Typography sx={{ color: '#929292', fontWeight: 'bold' }}>{chain.name}</Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
                  <Box>
                    <Typography sx={{ color: '#929292', fontSize: 12 }}>JPYC</Typography>
                    <Typography sx={{ fontSize: 'large' }}>{balance?.jpyc ?? '0.0'} 円</Typography>
                  </Box>
                  <Button variant="outlined" size="small" onClick={() => onSendJpycOrNative(chain.key, 'jpyc')}>
                    {t('balance.send')}
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderTop: '0.5px solid', borderColor: 'divider' }}>
                  <Box>
                    <Typography sx={{ color: '#929292', fontSize: 12 }}>{chain.nativeCurrency.symbol}</Typography>
                    <Typography sx={{ fontSize: 'large' }}>{balance?.native ?? '0.0'}</Typography>
                  </Box>
                  <Button variant="outlined" size="small" onClick={() => onSendJpycOrNative(chain.key, 'native')}>
                    {t('balance.send')}
                  </Button>
                </Box>

                {balance?.tokens.map((token) => (
                  <Box
                    key={token.address}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderTop: '0.5px solid', borderColor: 'divider' }}
                  >
                    <Box>
                      <Typography sx={{ color: '#929292', fontSize: 12 }}>{token.symbol}</Typography>
                      <Typography sx={{ fontSize: 'large' }}>{token.balance}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Button variant="outlined" size="small" onClick={() => onSendToken(chain.key, token)}>
                        {t('balance.send')}
                      </Button>
                      {isCustomToken(chain.key, token) && (
                        <IconButton
                          size="small"
                          aria-label={t('balance.remove_token')}
                          onClick={() => onRemoveToken(chain.key, token)}
                        >
                          <CloseIcon fontSize="small" sx={{ color: '#929292' }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                ))}

                <Box sx={{ px: 2, py: 1, borderTop: '0.5px solid', borderColor: 'divider' }}>
                  <Button
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={() => openDialog(chain.key)}
                    sx={{ color: '#929292' }}
                  >
                    {t('balance.add_token')}
                  </Button>
                </Box>

                <Box component="img" src={balanceBackground} sx={{ display: 'block', ml: 'auto', maxWidth: 120, width: '40%', opacity: 0.6 }} />
              </Card>
            );
          })}

          {symbolBalance !== null && (
            <Card>
              <Box sx={{ px: 2, pt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="img" src={iconSymbol} sx={{ width: 20, height: 20, borderRadius: '50%' }} />
                <Typography sx={{ color: '#929292', fontWeight: 'bold' }}>Symbol</Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
                <Box>
                  <Typography sx={{ color: '#929292', fontSize: 12 }}>XYM</Typography>
                  <Typography sx={{ fontSize: 'large' }}>{symbolBalance}</Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onSendSymbol}
                  sx={{ color: SYMBOL_VIOLET, borderColor: SYMBOL_VIOLET, '&:hover': { borderColor: SYMBOL_VIOLET } }}
                >
                  {t('balance.send')}
                </Button>
              </Box>

              <Box component="img" src={balanceBackground} sx={{ display: 'block', ml: 'auto', maxWidth: 120, width: '40%', opacity: 0.6 }} />
            </Card>
          )}
        </Box>
      )}

      <BottomNav active="token" />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="xs">
        <DialogTitle>{t('balance.add_token_dialog_title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: 'small', mb: 2 }}>
            {t('balance.add_token_dialog_message')}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ color: '#929292', fontSize: 12 }}>{t('balance.chain_label')}</Typography>
            <Typography sx={{ fontSize: 'large' }}>{CHAINS[formChain].name}</Typography>
          </Box>
          <TextField
            label={t('balance.contract_address_label')}
            placeholder="0x..."
            fullWidth
            margin="dense"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>{t('common.cancel')}</Button>
          <Button onClick={onSubmitToken} variant="contained" disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
