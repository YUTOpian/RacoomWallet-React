import { useEffect, useState, useCallback } from 'react';
import { Box, Card, CardActionArea, Typography, CircularProgress, Button, Snackbar, IconButton } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CurrencyYenIcon from '@mui/icons-material/CurrencyYen';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CardRibbon from '../../components/CardRibbon';
import { useEvmBalance } from '../../hooks/useEvmBalance';
import { useTransactions } from '../../hooks/useTransactions';
import { WalletsHelper, AddressBookHelper } from '../../lib/storage';
import { fetchTotalAssetsJpy } from '../../lib/chains';
import type { TransactionWrapper } from '../../lib/transactionWrapper';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import emptyTransactionIcon from '../../assets/image_empty1_small.png';
import iconReceive from '../../assets/icon_home_receive_green.png';
import iconSend from '../../assets/icon_home_send_green.png';
import iconScan from '../../assets/icon_home_scan_green.png';
import balanceCardBackground from '../../assets/image_home_balance_background.png';

interface HomeProps {
  needsUpdate: boolean;
}

// How many recent transactions to show on the Home card (the full history lives on
// TransactionList, reached via this card's tap area).
const HOME_TRANSACTION_COUNT = 3;

// Resolves each transaction's counterpart address to an address-book contact name, when
// one is registered - falling back to a shortened address otherwise. Looked up once per
// render batch (not per keystroke/poll) since the address book rarely changes mid-session.
function shortenAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export default function Home({ needsUpdate }: HomeProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { jpycBalance, fetchEvmBalance } = useEvmBalance();
  const { fetchTransactions } = useTransactions();

  const [loadingBalance, setLoadingBalance] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<TransactionWrapper[]>([]);
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [address, setAddress] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);
  // Whether the Balance card shows the total-assets figure (every held chain's native
  // coin + curated tokens + JPYC, all converted to JPY) instead of the default
  // active-chain JPYC balance - toggled via the icon button on the card. Defaults to
  // JPYC since that's the figure that doesn't depend on a price feed being reachable.
  const [showTotalAssets, setShowTotalAssets] = useState(false);
  const [loadingTotalAssets, setLoadingTotalAssets] = useState(true);
  const [totalAssetsJpy, setTotalAssetsJpy] = useState(0);

  const onCopyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setAddressCopied(true);
    } catch (e) {
      console.error('Failed to copy address', e);
    }
  }, [address]);

  const update = useCallback(async () => {
    setLoadingBalance(true);
    setLoadingTransactions(true);
    setLoadingTotalAssets(true);
    const activeWallet = await WalletsHelper.getActive();
    if (activeWallet == null) {
      setRecentTransactions([]);
      setAddress('');
      setLoadingBalance(false);
      setLoadingTransactions(false);
      setTotalAssetsJpy(0);
      setLoadingTotalAssets(false);
      return;
    }
    setAddress(activeWallet.address);
    // Balance, recent transactions and the total-assets figure are all independent - the
    // screen's total load time is bounded by the single slowest of the three, not their
    // sum.
    await Promise.all([
      fetchEvmBalance().finally(() => setLoadingBalance(false)),
      fetchTransactions(HOME_TRANSACTION_COUNT, false, async (confirmed) => {
        setRecentTransactions(confirmed);
        // Resolve each row's counterpart address to an address-book name, when one is
        // registered, so the card can show "田中さん" instead of a raw address (see
        // shortenAddress's fallback for unregistered addresses).
        const entries = await Promise.all(
          confirmed.map(async (tx) => {
            const contact = await AddressBookHelper.findByAddress(tx.peer);
            return [tx.peer.toLowerCase(), contact?.name ?? null] as const;
          })
        );
        setPeerNames(Object.fromEntries(entries.filter(([, name]) => name != null) as [string, string][]));
      }).finally(() => setLoadingTransactions(false)),
      fetchTotalAssetsJpy(activeWallet.address)
        .then(setTotalAssetsJpy)
        .catch((e) => console.error('Failed to fetch total assets', e))
        .finally(() => setLoadingTotalAssets(false)),
    ]);
  }, [fetchEvmBalance, fetchTransactions]);

  useEffect(() => {
    update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (needsUpdate) {
      update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsUpdate]);

  return (
    <Box sx={{ width: '100vw', px: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', mt: 5 }}>
        <Card sx={{ background: 'linear-gradient(135deg, #92D6CD 0%, #3E867D 100%)', position: 'relative', overflow: 'hidden', mt: '-10px' }}>
          {/* Balance no longer doubles as a link to the transaction history (that's the
              Transaction card below), nor to the per-chain asset list (that's the トークン
              slot in the bottom nav, see Top.tsx) - it just shows the wallet's address and
              the JPYC total. Laid out address-then-balance, on a teal gradient (matching
              the uploaded reference color) with the same diamond illustration this card
              used to carry before it was briefly swapped for the send/swap complete
              screens' crystal illustration - the "Balance" ribbon
              itself is kept as-is (still orange). */}
          <Box
            component="img"
            src={balanceCardBackground}
            sx={{ position: 'absolute', right: 0, bottom: 0, maxWidth: 220, width: '60%', pointerEvents: 'none' }}
          />
          <Box sx={{ position: 'relative', px: 2, pt: 1.5, pb: 2 }}>
            <IconButton
              size="small"
              onClick={() => setShowTotalAssets((v) => !v)}
              aria-label={showTotalAssets ? t('home.switch_to_jpyc_balance') : t('home.switch_to_total_assets')}
              sx={{ position: 'absolute', top: 4, right: 4, color: 'white' }}
            >
              {showTotalAssets ? <CurrencyYenIcon fontSize="small" /> : <AccountBalanceWalletIcon fontSize="small" />}
            </IconButton>

            <CardRibbon text={t('home.balance_ribbon')} bgcolor="nemOrange" icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 14, color: 'white' }} />} />

            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)' }}>{t('home.address_label')}</Typography>
              <Box
                onClick={onCopyAddress}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: address ? 'pointer' : 'default', width: 'fit-content' }}
              >
                <Typography sx={{ fontSize: '0.8rem', color: 'white', fontWeight: 'bold', wordBreak: 'break-all' }}>
                  {address || '-'}
                </Typography>
                {address && <ContentCopyIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', flexShrink: 0 }} />}
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.85)' }}>
                {showTotalAssets ? t('home.total_assets_label') : t('home.jpyc_balance_label')}
              </Typography>
              {(showTotalAssets ? loadingTotalAssets : loadingBalance) ? (
                <CircularProgress size={22} sx={{ color: 'white', mt: 0.5 }} />
              ) : (
                <Typography sx={{ fontSize: 'xx-large', color: 'white', fontWeight: 'bold', lineHeight: 1.2 }}>
                  {showTotalAssets
                    ? new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(totalAssetsJpy)
                    : Number(jpycBalance).toLocaleString()}
                </Typography>
              )}
            </Box>
          </Box>
        </Card>

        <Card sx={{ mt: 2 }}>
          {/* SWAP used to live here as its own card; it's reachable from the bottom nav
              now (see Top.tsx), which freed this slot for RECEIVE/SEND/SCAN - previously
              only reachable via the bottom nav, now that two of its slots were repurposed
              for SWAP and トークン. Each button just re-selects the corresponding in-page
              tab (via the same ?tab= query param Top.tsx's own tab switcher uses), rather
              than navigating to a separate route, so Top's cross-tab state (e.g. an
              in-progress Send address) is preserved exactly as it is when switching tabs
              from the bottom nav. Placed directly under Balance (rather than below
              Transaction) to match the more current layout where the primary actions sit
              right beneath the balance figure. */}
          <Box sx={{ display: 'flex' }}>
            <Button
              onClick={() => navigate('/top?tab=receive', { replace: true })}
              sx={{ flex: 1, flexDirection: 'column', gap: 0.5, py: 2, borderRadius: 0, color: 'text.primary', textTransform: 'none' }}
            >
              <Box component="img" src={iconReceive} sx={{ height: 26 }} />
              <Typography sx={{ fontSize: '0.65rem' }}>{t('home.receive')}</Typography>
            </Button>
            <Button
              onClick={() => navigate('/top?tab=send', { replace: true })}
              sx={{ flex: 1, flexDirection: 'column', gap: 0.5, py: 2, borderRadius: 0, color: 'text.primary', textTransform: 'none', borderLeft: '0.5px solid', borderRight: '0.5px solid', borderColor: 'divider' }}
            >
              <Box component="img" src={iconSend} sx={{ height: 26 }} />
              <Typography sx={{ fontSize: '0.65rem' }}>{t('home.send')}</Typography>
            </Button>
            <Button
              onClick={() => navigate('/top?tab=scan', { replace: true })}
              sx={{ flex: 1, flexDirection: 'column', gap: 0.5, py: 2, borderRadius: 0, color: 'text.primary', textTransform: 'none' }}
            >
              <Box component="img" src={iconScan} sx={{ height: 26 }} />
              <Typography sx={{ fontSize: '0.65rem' }}>{t('home.scan')}</Typography>
            </Button>
          </Box>
        </Card>

        <Card sx={{ mt: 2, mb: 2 }}>
          {/* Renamed from the original app's "Token" card (which showed a native-coin
              price ticker) back to "Transaction" - the label the NEM-era app used for this
              card. Now shows the actual JPYC transfer history (see useTransactions), with
              each counterpart resolved to its address-book name when one is registered. */}
          <CardActionArea onClick={() => navigate('/transaction/list')}>
            <CardRibbon text={t('home.transaction_ribbon')} bgcolor="nemBlue" icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 14, color: 'white' }} />} />
            {loadingTransactions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 64 }}>
                <CircularProgress color="primary" />
              </Box>
            ) : recentTransactions.length === 0 ? (
              <Box sx={{ display: 'flex' }}>
                <Box component="img" src={emptyTransactionIcon} sx={{ display: 'inline-block', mt: 1, mb: 1, ml: 2, height: 60 }} />
                <Typography sx={{ textAlign: 'center', mt: 1, color: 'text.secondary' }}>{t('home.no_transaction_title')}<br />{t('home.no_transaction_message')}</Typography>
              </Box>
            ) : (
              <Box sx={{ py: 0.5, px: 2 }}>
                {recentTransactions.map((tx) => {
                  const displayName = peerNames[tx.peer.toLowerCase()] ?? shortenAddress(tx.peer);
                  return (
                    <Box key={tx.hash} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderTop: '0.5px solid', borderColor: 'divider' }}>
                      {tx.chain && (
                        <Box component="img" src={CHAIN_ICONS[tx.chain]} sx={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                      )}
                      {tx.isReception ? (
                        <SouthWestIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                      ) : (
                        <NorthEastIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      )}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                          {displayName}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                          {tx.dateString}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: tx.isReception ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap' }}>
                        {tx.isReception ? '+' : '-'}{tx.amount} {tx.currencySymbol}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </CardActionArea>
        </Card>
      </Box>

      <Snackbar
        open={addressCopied}
        autoHideDuration={2000}
        onClose={() => setAddressCopied(false)}
        message={t('home.address_copied')}
      />
    </Box>
  );
}
