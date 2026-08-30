import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Button, CircularProgress } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { useNavigate } from 'react-router-dom';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import MessageDialog from '../../components/MessageDialog';
import PinDialog from '../../components/PinDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import SymbolBottomNav, { SYMBOL_BOTTOM_NAV_HEIGHT } from '../../components/SymbolBottomNav';
import SymbolBackupHero from '../../components/SymbolBackupHero';
import cautionIcon from '../../assets/icon_caution.png';
import { WalletsHelper } from '../../lib/storage';
import { SymbolAccountHelper } from '../../lib/symbolAccount';

type ScreenState = 'loading' | 'no_wallet' | 'locked' | 'ready';

// Symbol (XYM) private-key backup - separate from WalletBackup.tsx, which shows the
// wallet's EVM (secp256k1) private key / mnemonic. Symbol uses an unrelated ed25519
// keypair deterministically derived from that same EVM key (see lib/symbolAccount.ts),
// so it needs its own decrypt-then-derive step and its own screen: showing the EVM key
// here would let someone mistake it for the Symbol one, or vice versa, and the two are
// not interchangeable for import into a Symbol-only wallet.
export default function SymbolBackup() {
  const navigate = useNavigate();
  const [state, setState] = useState<ScreenState>('loading');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setLoadError(false);
    setRevealed(false);
    setPrivateKey('');
    const activeWallet = await WalletsHelper.getActive();
    if (!activeWallet) {
      setState('no_wallet');
      return;
    }
    setWalletId(activeWallet.id);
    setState('locked');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onUnlockPassed = async (pin: string) => {
    if (!walletId) return;
    try {
      const evmPrivateKey = await WalletsHelper.decryptKey(walletId, pin);
      if (!evmPrivateKey) {
        setErrorMessage('Incorrect PIN');
        return;
      }
      const account = SymbolAccountHelper.fromPrivateKey(evmPrivateKey);
      setPrivateKey(account.privateKeyHex);
      setLoadError(account.privateKeyHex.trim().length === 0);
      setState('ready');
      setShowPinDialog(false);
    } catch (e) {
      console.error('SymbolBackup: failed to derive Symbol private key', e);
      setLoadError(true);
      setState('ready');
      setErrorMessage('Failed to generate the Symbol private key');
    }
  };

  const onCopy = async () => {
    if (!privateKey) return;
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
  };

  return (
    <Box sx={{ width: '100vw', pb: `${SYMBOL_BOTTOM_NAV_HEIGHT}px` }}>
      <AppToolBar back="/symbol" title="Symbol Backup" />
      <WalletBar isOpened={false} />
      <SymbolBackupHero />

      {state === 'loading' ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : state === 'no_wallet' ? (
        <Box sx={{ px: 2, mt: 8, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            ウォレットが見つからないため、バックアップできません。
          </Typography>
        </Box>
      ) : state === 'locked' ? (
        <Box sx={{ px: 2, mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Symbolの秘密鍵を表示するには、PINの入力が必要です。
          </Typography>
          <Button variant="contained" disableElevation onClick={() => setShowPinDialog(true)}>
            PINを入力して秘密鍵を表示
          </Button>
        </Box>
      ) : (
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 4, gap: 1 }}>
            <Box component="img" src={cautionIcon} sx={{ width: 16, height: 16 }} />
            <span>Symbol private key</span>
          </Box>

          <Typography align="center" sx={{ mt: 2, mx: 2, color: 'text.secondary', fontSize: 14 }}>
            この秘密鍵は誰にも共有しないでください。第三者に知られると、資産が盗まれる可能性があります。
          </Typography>

          {loadError ? (
            <Typography align="center" sx={{ mt: 2, mx: 2, color: 'error.main' }}>
              秘密鍵の取得に失敗しました。
            </Typography>
          ) : (
            <>
              <Typography align="center" sx={{ mt: 3, color: 'error.main' }}>Private Key</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1, mx: 2 }}>
                <Typography
                  align="center"
                  sx={{
                    wordBreak: 'break-all',
                    filter: revealed ? 'none' : 'blur(6px)',
                    userSelect: revealed ? 'text' : 'none',
                    transition: 'filter 0.15s ease',
                  }}
                >
                  {privateKey}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 2 }}>
                <IconButton
                  size="small"
                  onClick={() => setRevealed((v) => !v)}
                  aria-label={revealed ? 'Hide private key' : 'Show private key'}
                >
                  {revealed ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                </IconButton>
                <IconButton size="small" onClick={onCopy} aria-label="Copy private key" disabled={!revealed}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </>
          )}
        </Box>
      )}

      <SymbolBottomNav active="backup" onHarvestClick={() => navigate('/symbol/harvest')} hideOther />

      <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onUnlockPassed} />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />

      <MessageDialog
        open={copied}
        title="Copied"
        texts={['Your Symbol private key has been copied to the clipboard.']}
        onClose={() => setCopied(false)}
      />
    </Box>
  );
}
