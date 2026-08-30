import { useEffect, useState } from 'react';
import {
  Box, Card, Typography, TextField, Button, CircularProgress, Alert, IconButton, AppBar, Toolbar,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';
import AppToolBar from '../../components/AppToolBar';
import PinDialog from '../../components/PinDialog';
import MessageDialog from '../../components/MessageDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { CustomChainsHelper, CustomTokensHelper, WalletsHelper } from '../../lib/storage';
import type { CustomChainRecord } from '../../lib/storage';
import type { TokenInfo } from '../../lib/chains';
import { extractRpcMessage } from '../../lib/chains';
import {
  fetchCustomChainNativeBalance, fetchCustomChainTokenBalance, estimateCustomChainSendFee,
  sendCustomChainNative, sendCustomChainToken,
} from '../../lib/customChains';
import iconPinSmall from '../../assets/icon_pin_small.png';

// Opened from AssetRecoveryList's 送金 button as
// /settings/asset_recovery/send?chain=<CustomChainRecord.id>&token=native|<address>
export default function AssetRecoverySend() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chainId = searchParams.get('chain') ?? '';
  const tokenParam = searchParams.get('token') ?? 'native';
  const isToken = tokenParam !== 'native';

  const [chain, setChain] = useState<CustomChainRecord | null>(null);
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [symbol, setSymbol] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [estimatedFee, setEstimatedFee] = useState<string | null | 'loading'>(null);

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const record = await CustomChainsHelper.get(chainId);
      setChain(record);
      if (!record) {
        setLoading(false);
        return;
      }
      const activeWallet = await WalletsHelper.getActive();
      if (isToken) {
        const custom = await CustomTokensHelper.list(record.id);
        const match = custom.find((t) => t.address.toLowerCase() === tokenParam.toLowerCase());
        if (match) {
          setToken(match);
          setSymbol(match.symbol);
          if (activeWallet) {
            const b = await fetchCustomChainTokenBalance(record.rpcUrl, match, activeWallet.address).catch(() => null);
            setBalance(b?.balance ?? null);
          }
        }
      } else {
        setSymbol(record.currencySymbol);
        if (activeWallet) {
          const b = await fetchCustomChainNativeBalance(record.rpcUrl, activeWallet.address).catch(() => null);
          setBalance(b);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, tokenParam]);

  useEffect(() => {
    if (!chain || !ethers.isAddress(address) || amount.trim().length === 0) {
      setEstimatedFee(null);
      return;
    }
    let cancelled = false;
    setEstimatedFee('loading');
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet) return;
      const fee = await estimateCustomChainSendFee(chain.rpcUrl, activeWallet.address, address, amount, token ?? undefined);
      if (!cancelled) setEstimatedFee(fee);
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, address, amount, token]);

  const onSetMax = () => {
    if (balance != null) setAmount(balance);
  };

  const onOpenPin = () => {
    if (!ethers.isAddress(address)) {
      setErrorMessage(t('asset_recovery.send.error_invalid_recipient'));
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setErrorMessage(t('asset_recovery.send.error_invalid_amount'));
      return;
    }
    setShowPinDialog(true);
  };

  const onPassed = async (pin: string) => {
    if (!chain) return;
    setSending(true);
    setErrorMessage('');
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet) return;
      const privateKey = await WalletsHelper.decryptKey(activeWallet.id, pin);
      if (privateKey == null) {
        setErrorMessage(t('asset_recovery.send.error_incorrect_passcode'));
        return;
      }
      const receipt = isToken && token
        ? await sendCustomChainToken(chain.rpcUrl, chain.chainId, privateKey, token, address, amount)
        : await sendCustomChainNative(chain.rpcUrl, chain.chainId, privateKey, address, amount);
      setTxHash((receipt && receipt.hash) || '');
    } catch (error) {
      setErrorMessage(extractRpcMessage(error));
    } finally {
      setSending(false);
    }
  };

  const onCloseComplete = () => {
    setTxHash(null);
    navigate('/settings/asset_recovery');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!chain || (isToken && !token)) {
    return (
      <Box>
        <AppToolBar back="/settings/asset_recovery" title={t('asset_recovery.send.title')} />
        <Alert severity="error" sx={{ m: 2 }}>{t('asset_recovery.send.not_found_error')}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh' }}>
      <AppToolBar back="/settings/asset_recovery" title={`Send from ${chain.name}`} />
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {chain.name}は取扱いをサポートしていないネットワークです。宛先アドレスは必ずご自身で確認のうえ送金してください。
        </Alert>

        <Card sx={{ p: 2 }}>
          <Typography sx={{ color: '#929292', fontSize: 12 }}>Balance</Typography>
          <Typography sx={{ fontSize: 'large', mb: 2 }}>{balance ?? '0.0'} {symbol}</Typography>

          <Typography sx={{ fontSize: 14, mb: 0.5 }}>Recipient address</Typography>
          <TextField
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            margin="dense"
            disabled={sending}
          />

          <Typography sx={{ fontSize: 14, mb: 0.5, mt: 2 }}>Amount to send</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
              margin="dense"
              disabled={sending}
              inputMode="decimal"
            />
            <Button onClick={onSetMax} disabled={sending || balance == null} sx={{ whiteSpace: 'nowrap' }}>
              最大
            </Button>
          </Box>

          <Typography sx={{ color: '#929292', fontSize: 12, mt: 2 }}>
            推定ガス代:{' '}
            {estimatedFee === 'loading'
              ? 'Estimating...'
              : estimatedFee != null
                ? `About ${estimatedFee} ${chain.currencySymbol}`
                : '—'}
          </Typography>
        </Card>
      </Box>

      <Box sx={{ position: 'sticky', bottom: 0, maxWidth: 480 }}>
        <AppBar position="static" color="default">
          <Toolbar sx={{ justifyContent: 'center' }}>
            <Typography>{sending ? 'Sending...' : 'Enter your passcode to send'}</Typography>
            <IconButton
              disabled={sending}
              onClick={onOpenPin}
              sx={{ bgcolor: 'white', mx: 1, width: 40, height: 40 }}
            >
              <Box component="img" src={iconPinSmall} sx={{ width: '100%' }} />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box sx={{ width: '100%', height: 4, bgcolor: 'primary.main' }} />
      </Box>

      <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onPassed} />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      <MessageDialog
        open={txHash !== null}
        title="Sent"
        texts={txHash ? [`Transaction hash:`, txHash] : ['Your transfer is complete.']}
        onClose={onCloseComplete}
      />
    </Box>
  );
}
