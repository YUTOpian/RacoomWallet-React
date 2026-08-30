import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, AppBar, Toolbar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import MessageDialog from '../../components/MessageDialog';
import PinDialog from '../../components/PinDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { WalletsHelper } from '../../lib/storage';
import { CHAINS, sendJpyc, sendNative, sendErc20, parseSendError, estimateSendFee } from '../../lib/chains';
import type { ChainKey, ParsedSendError } from '../../lib/chains';
import { useAppStore } from '../../store/appStore';
import { ethers } from 'ethers';
import heroSendSmall from '../../assets/heroimage_send_small.png';
import iconPinSmall from '../../assets/icon_pin_small.png';

export default function SendConfirmation() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const backPath = useAppStore((s) => s.backPathFromSendConfirmation);
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const receiverAddress = useAppStore((s) => s.receiverAddress);
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;
  const sendCurrency = useAppStore((s) => s.sendCurrency);
  const sendTokenMeta = useAppStore((s) => s.sendTokenMeta);
  const setLastTxHash = useAppStore((s) => s.setLastTxHash);

  const activeChainConfig = CHAINS[activeChain];
  const isToken = sendCurrency !== 'jpyc' && sendCurrency !== 'native';
  const currencyLabel = isToken ? (sendTokenMeta?.symbol ?? '') : sendCurrency === 'jpyc' ? 'JPYC' : activeChainConfig.nativeCurrency.symbol;

  const [showSendCaution, setShowSendCaution] = useState(true);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sendError, setSendError] = useState<ParsedSendError | null>(null);
  // 'loading' while the estimate request is in flight, null once it settles with no result
  // (bad address, RPC failure) so the UI can fall back to "not available" instead of "0".
  const [estimatedFee, setEstimatedFee] = useState<string | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setEstimatedFee('loading');
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet || cancelled) return;
      const currency = sendCurrency === 'native' ? 'native' : sendCurrency === 'jpyc' ? 'jpyc' : 'token';
      const fee = await estimateSendFee(
        activeChain,
        activeWallet.address,
        receiverAddress,
        currency,
        calculatorFormula,
        sendTokenMeta ? { address: sendTokenMeta.address, decimals: sendTokenMeta.decimals } : undefined,
      );
      if (!cancelled) {
        setEstimatedFee(fee);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeChain, receiverAddress, sendCurrency, calculatorFormula, sendTokenMeta]);

  const onPassed = async (pin: string) => {
    const amount = calculatorFormula;
    const to = receiverAddress;

    if (!ethers.isAddress(to)) {
      setErrorMessage(t('common.invalid_address'));
      return;
    }

    setSending(true);
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet) {
        return;
      }
      const privateKey = await WalletsHelper.decryptKey(activeWallet.id, pin);
      if (privateKey == null) {
        setErrorMessage(t('wallet.invalid_key'));
        return;
      }

      let receipt;
      if (sendCurrency === 'jpyc') {
        receipt = await sendJpyc(activeChain, privateKey, to, amount);
      } else if (sendCurrency === 'native') {
        receipt = await sendNative(activeChain, privateKey, to, amount);
      } else if (sendTokenMeta != null) {
        receipt = await sendErc20(activeChain, privateKey, sendTokenMeta.address, sendTokenMeta.decimals, to, amount);
      } else {
        throw new Error('Unknown send currency');
      }

      setLastTxHash((receipt && receipt.hash) || '');
      navigate('/send/complete');
    } catch (error) {
      setSendError(parseSendError(error, { chain: activeChain, isNativeSend: sendCurrency === 'native', amount }));
    } finally {
      setSending(false);
    }
  };

  // Turns the classified send error into a dialog title + list of lines, in the current
  // language. Kept out of parseSendError() itself (lib/chains.ts) since that file has no
  // access to i18n and shouldn't need to.
  const sendErrorTitle = sendError
    ? t(`send.error_${sendError.kind}_title`)
    : '';
  // The detailed (amount/fee/total/balance) template only makes sense once we've actually
  // parsed those figures out of the RPC error - if we couldn't, fall back to a plain-
  // language explanation of the same kind rather than let "undefined" show up in the UI.
  const hasFigures = sendError?.estimatedFee != null || sendError?.balance != null;
  const sendErrorMessageKey = sendError
    ? (sendError.kind === 'insufficient_gas' || sendError.kind === 'insufficient_total') && !hasFigures
      ? `send.error_${sendError.kind}_message_simple`
      : `send.error_${sendError.kind}_message`
    : '';
  const sendErrorTexts = sendError
    ? (t(sendErrorMessageKey, {
        returnObjects: true,
        symbol: sendError.symbol,
        amount: sendError.amount,
        fee: sendError.estimatedFee,
        total: sendError.requiredTotal,
        balance: sendError.balance,
        detail: sendError.rawMessage,
      }) as string[])
    : [];

  return (
    <Box sx={{ height: '100vh' }}>
      <AppToolBar back={backPath} title={t('send.confirmation_title')} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <WalletBar isOpened={false} />
        <Box component="img" src={heroSendSmall} sx={{ width: '100%' }} />

        <Box sx={{ px: 2 }}>
          <Typography sx={{ color: 'primary.main' }}>{t('common.amount')}</Typography>
          <Typography sx={{ fontSize: 'large' }}>{calculatorFormula} {currencyLabel}</Typography>

          <Typography sx={{ color: 'primary.main', mt: 1 }}>{t('send.network')}</Typography>
          <Typography>{activeChainConfig.name}</Typography>

          <Typography sx={{ color: 'primary.main', mt: 1 }}>{t('common.destination')}</Typography>
          <Typography sx={{ wordBreak: 'break-all' }}>{receiverAddress}</Typography>

          <Typography sx={{ color: 'primary.main', mt: 1 }}>{t('send.gas_fee')}</Typography>
          <Typography>
            {estimatedFee === 'loading'
              ? t('send.fee_estimating')
              : estimatedFee != null
                ? `${t('common.approx')} ${estimatedFee} ${activeChainConfig.nativeCurrency.symbol}`
                : t('send.fee_estimate_unavailable')}
          </Typography>
        </Box>
      </Box>

      <MessageDialog
        open={showSendCaution}
        title={t('send.confirmation_title')}
        texts={t('send.confirmation_dialog_message', { returnObjects: true }) as string[]}
        onClose={() => setShowSendCaution(false)}
      />

      <Box sx={{ position: 'sticky', bottom: 0, maxWidth: 480 }}>
        <AppBar position="static" color="default">
          <Toolbar sx={{ justifyContent: 'center' }}>
            <Typography>{sending ? t('send.sending') : t('send.confirmation_ready')}</Typography>
            <IconButton
              disabled={sending}
              onClick={() => setShowPinDialog(true)}
              sx={{ bgcolor: 'white', mx: 1, width: 40, height: 40 }}
            >
              <Box component="img" src={iconPinSmall} sx={{ width: '100%' }} />
            </IconButton>
            <Typography>{t('send.confirmation_pin')}</Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ width: '100%', height: 4, bgcolor: 'primary.main' }} />
      </Box>

      <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onPassed} />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      <MessageDialog
        open={sendError != null}
        title={sendErrorTitle}
        texts={sendErrorTexts}
        onClose={() => setSendError(null)}
      />
    </Box>
  );
}
