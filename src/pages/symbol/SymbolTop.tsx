import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, IconButton, CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNavigate } from 'react-router-dom';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import MessageDialog from '../../components/MessageDialog';
import PinDialog from '../../components/PinDialog';
import SymbolBottomNav, { SYMBOL_BOTTOM_NAV_HEIGHT } from '../../components/SymbolBottomNav';
import { WalletsHelper } from '../../lib/storage';
import { fetchSymbolBalance, fetchSymbolTransactions, fetchSymbolJpyRate } from '../../lib/symbolChain';
import type { SymbolTransactionSummary } from '../../lib/symbolChain';

function truncateAddress(address: string): string {
  // Symbol addresses are conventionally shown in 6-character groups (e.g.
  // ND5DNT-W5M6CV-...), matching how wallets/explorers display them.
  const groups = address.match(/.{1,6}/g) ?? [address];
  return groups.join('-');
}

// Gradient for the balance card, built from the violet swatch the person shared as a
// reference (#8239DD) - a lighter tint and a darker shade of that same color, so the
// card still reads as "that purple" rather than an unrelated multi-color gradient.
const BALANCE_CARD_GRADIENT = 'linear-gradient(135deg, #AE7EE9 0%, #8239DD 50%, #552590 100%)';

type ScreenState = 'loading' | 'no_wallet' | 'locked' | 'ready';

export default function SymbolTop() {
  const navigate = useNavigate();
  const [state, setState] = useState<ScreenState>('loading');
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');
  const [jpyValue, setJpyValue] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<SymbolTransactionSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bridgeComingSoonOpen, setBridgeComingSoonOpen] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);

  const loadBalanceAndTx = useCallback(async (addr: string) => {
    setRefreshing(true);
    try {
      const [balanceResult, jpyRate, txs] = await Promise.all([
        fetchSymbolBalance(addr),
        fetchSymbolJpyRate(),
        fetchSymbolTransactions(addr),
      ]);
      setBalance(balanceResult);
      setTransactions(txs);
      setJpyValue(jpyRate > 0 ? (Number(balanceResult) * jpyRate).toFixed(2) : null);
    } catch (e) {
      console.error('Failed to load Symbol balance/transactions', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Symbol unlocks the moment a correct PIN becomes known anywhere in the app (see
  // PinDialog's unlockSymbolIfPossible), so opening Symbol goes straight to the "ready"
  // balance view whenever the *active* wallet's Symbol account was already derived that
  // way. That said, unlockSymbolIfPossible only ever touches whichever wallet is active
  // *at the moment the PIN is entered* - when a wallet is freshly imported (see
  // WalletLoginImport), the PIN check that runs during import still targets the
  // previously-active wallet, since the new one isn't made active until just after the
  // dialog closes. So a newly imported wallet reliably lands here in "locked" state the
  // first time Symbol is opened. Rather than only pointing the person at Settings to set
  // a PIN there, this screen also offers a "Check PIN" button that opens PinDialog right
  // here (mode="check") - entering the existing PIN unlocks Symbol for the active wallet
  // immediately, without a detour.
  const load = useCallback(async () => {
    setState('loading');
    const activeWallet = await WalletsHelper.getActive();
    if (!activeWallet) {
      setState('no_wallet');
      return;
    }
    if (activeWallet.symbolAddress) {
      setAddress(activeWallet.symbolAddress);
      setState('ready');
      await loadBalanceAndTx(activeWallet.symbolAddress);
      return;
    }

    setState('locked');
  }, [loadBalanceAndTx]);

  useEffect(() => {
    load();
  }, [load]);

  const onCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
  };

  return (
    <Box sx={{ width: '100vw', pb: `${SYMBOL_BOTTOM_NAV_HEIGHT}px` }}>
      <AppToolBar back="/top?tab=home" title="Symbol" />
      <WalletBar isOpened={false} />

      {state === 'loading' ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : state === 'no_wallet' ? (
        <Box sx={{ px: 2, mt: 8, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            ウォレットが見つからないため、Symbol(XYM)機能は利用できません。
          </Typography>
        </Box>
      ) : state === 'locked' ? (
        <Box sx={{ px: 2, mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <LockOutlinedIcon sx={{ fontSize: 40, color: '#929292' }} />
          <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Symbolアドレスはこのウォレットの秘密鍵から生成されます。
            PINコードを入力すると利用できるようになります。
          </Typography>
          <Button variant="contained" disableElevation onClick={() => setShowPinDialog(true)}>
            PINコードを確認する
          </Button>
          <Button variant="text" onClick={() => navigate('/settings/top')}>
            PINコードをまだ設定していない
          </Button>
        </Box>
      ) : (
        <Box sx={{ px: 2, mt: 5, display: 'flex', flexDirection: 'column', gap: 2, pb: 4 }}>
          {/* Pulled up slightly so the top of the card tucks just behind the WalletBar
              notch above (zIndex 1, so it stays on top/visible/clickable) - same "slight
              overlap" idiom as Home's own balance card (see Home.tsx). Kept small enough
              that the address row below still clears the notch with room to spare. */}
          <Card sx={{ p: 2, background: BALANCE_CARD_GRADIENT, color: 'white', mt: '-10px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>
                {address ? truncateAddress(address) : ''}
              </Typography>
              <IconButton size="small" onClick={onCopy} aria-label="Copy address" sx={{ color: 'white' }}>
                <ContentCopyIcon fontSize="inherit" />
              </IconButton>
              {refreshing && <CircularProgress size={14} sx={{ ml: 'auto', color: 'white' }} />}
            </Box>

            <Box sx={{ mt: 1 }}>
              <Typography component="span" sx={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>{balance}</Typography>
              <Typography component="span" sx={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', ml: 0.5 }}>XYM</Typography>
            </Box>
            {jpyValue && (
              <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{jpyValue} JPY</Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<ArrowUpwardIcon />}
                sx={{ borderRadius: 999, bgcolor: 'rgba(255,255,255,0.18)', color: 'white', boxShadow: 'none' }}
                onClick={() => navigate('/symbol/send')}
              >
                送信
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<ArrowDownwardIcon />}
                sx={{ borderRadius: 999, bgcolor: 'rgba(255,255,255,0.18)', color: 'white', boxShadow: 'none' }}
                onClick={() => navigate('/symbol/receive')}
              >
                受信
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                sx={{ borderRadius: 999, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', boxShadow: 'none' }}
                onClick={() => setBridgeComingSoonOpen(true)}
              >
                BRIDGE
              </Button>
            </Box>
          </Card>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontWeight: 'bold', color: '#929292' }}>Recent transactions</Typography>
            <Button size="small" onClick={() => navigate('/symbol/transaction/list')}>View all</Button>
          </Box>

          <Card>
            {transactions.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>No transaction history</Typography>
              </Box>
            ) : (
              transactions.slice(0, 5).map((tx, index) => (
                <Box
                  key={tx.hash || index}
                  onClick={() => navigate('/symbol/transaction/detail', { state: { tx, selfAddress: address } })}
                  sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5,
                    borderTop: index === 0 ? 'none' : '0.5px solid', borderColor: 'divider', cursor: 'pointer',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {tx.direction === 'out' ? <ArrowUpwardIcon fontSize="small" color="error" /> : <ArrowDownwardIcon fontSize="small" color="success" />}
                    <Box>
                      <Typography sx={{ fontSize: 13 }}>{tx.direction === 'out' ? 'Send' : 'Receive'}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#929292' }}>{truncateAddress(tx.counterparty)}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 14, color: tx.direction === 'out' ? 'error.main' : 'success.main' }}>
                    {tx.direction === 'out' ? '-' : '+'}{tx.amount || '0'} XYM
                  </Typography>
                </Box>
              ))
            )}
          </Card>
        </Box>
      )}

      {state === 'ready' && (
        <SymbolBottomNav active={null} onHarvestClick={() => navigate('/symbol/harvest')} />
      )}

      <PinDialog
        open={showPinDialog}
        mode="check"
        onClose={() => setShowPinDialog(false)}
        // PinDialog's own unlockSymbolIfPossible already derived and cached the active
        // wallet's Symbol account as soon as the PIN checked out - reload() just needs to
        // re-read that from storage to flip this screen from "locked" to "ready".
        onPass={() => load()}
      />
      <MessageDialog
        open={bridgeComingSoonOpen}
        title="Coming soon"
        texts={["The bXYM bridge feature is coming soon.", "It's planned for implementation alongside the NEM/Symbol core devs' support for bXYM (wrapped XYM)."]}
        onClose={() => setBridgeComingSoonOpen(false)}
      />
      <MessageDialog
        open={copied}
        title="Copied"
        texts={['Your Symbol address has been copied to the clipboard.']}
        onClose={() => setCopied(false)}
      />
    </Box>
  );
}
