import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, AppBar, Toolbar, Dialog,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import CloseIcon from '@mui/icons-material/Close';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import PinDialog from '../../components/PinDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { WalletsHelper } from '../../lib/storage';
import { SymbolAccountHelper } from '../../lib/symbolAccount';
import {
  fetchSymbolBalance, estimateSymbolSendFee, sendSymbolTransfer,
} from '../../lib/symbolChain';
import { isValidSymbolAddress, extractSymbolAddressFromQr } from '../../lib/symbolQr';
import SymbolHero from '../../components/SymbolHero';
import { useAppStore } from '../../store/appStore';

// Symbol's brand violet - the same swatch as the balance card gradient (SymbolTop.tsx)
// and SymbolHero, used here for the 全額 button and the toolbar's back arrow so this
// screen reads consistently with the rest of the Symbol section rather than the app's
// default teal primary color.
const SYMBOL_VIOLET = '#8239DD';

type Step = 'form' | 'confirm' | 'complete';

export default function SymbolSend() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Set when this screen was reached via Home's SEND button -> the numpad screen (see
  // pages/top/Send.tsx and pages/send/SendSymbolAmount.tsx), rather than via the Symbol
  // tab's own 送信 button. Changes two things: the recipient/amount fields below start
  // pre-filled from what was already entered on those screens, and completing the send
  // returns to the Home screen instead of the Symbol screen (see the 'complete' step and
  // onPassed below).
  const fromHome = searchParams.get('fromHome') === '1';
  const storeReceiverAddress = useAppStore((s) => s.receiverAddress);
  const storeCalculatorFormula = useAppStore((s) => s.calculatorFormula);
  const clearReceiverAddress = useAppStore((s) => s.clearReceiverAddress);
  const clearCalculatorFormula = useAppStore((s) => s.clearCalculatorFormula);

  const [walletId, setWalletId] = useState<string | null>(null);
  const [senderPublicKey, setSenderPublicKey] = useState('');
  const [balance, setBalance] = useState('0');

  const [recipient, setRecipient] = useState(() => (fromHome ? storeReceiverAddress : ''));
  const [amount, setAmount] = useState(() => (fromHome ? storeCalculatorFormula : ''));
  const [message, setMessage] = useState('');
  const [addressError, setAddressError] = useState('');
  const [amountError, setAmountError] = useState('');

  const [step, setStep] = useState<Step>('form');
  const [estimatedFee, setEstimatedFee] = useState<string | null | 'loading'>('loading');
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet?.symbolAddress || !activeWallet.symbolPublicKey) {
        return;
      }
      setWalletId(activeWallet.id);
      setSenderPublicKey(activeWallet.symbolPublicKey);
      const b = await fetchSymbolBalance(activeWallet.symbolAddress);
      setBalance(b);
    })();
  }, []);

  const onSetMax = () => setAmount(balance);

  const onDecodeQr = (decoded: string) => {
    const address = extractSymbolAddressFromQr(decoded);
    if (!address) {
      setErrorMessage("Couldn't read a Symbol address from the QR code");
      return;
    }
    setRecipient(address);
    setAddressError('');
    setShowScanner(false);
  };

  const onConfirm = async () => {
    let hasError = false;
    if (!isValidSymbolAddress(recipient.trim().toUpperCase())) {
      setAddressError('Please enter a valid Symbol address (starting with N)');
      hasError = true;
    } else {
      setAddressError('');
    }
    const numericAmount = Number(amount);
    if (!(numericAmount > 0)) {
      setAmountError('Please enter an amount');
      hasError = true;
    } else if (numericAmount > Number(balance)) {
      setAmountError('Insufficient balance');
      hasError = true;
    } else {
      setAmountError('');
    }
    if (hasError) return;

    setStep('confirm');
    setEstimatedFee('loading');
    try {
      const fee = await estimateSymbolSendFee(senderPublicKey, recipient.trim().toUpperCase(), amount, message);
      setEstimatedFee(fee);
    } catch (e) {
      console.error('Failed to estimate Symbol send fee', e);
      setEstimatedFee(null);
    }
  };

  const onPassed = async (pin: string) => {
    if (!walletId) return;
    setSending(true);
    try {
      const privateKey = await WalletsHelper.decryptKey(walletId, pin);
      if (!privateKey) {
        setErrorMessage('Incorrect PIN');
        return;
      }
      const account = SymbolAccountHelper.fromPrivateKey(privateKey);
      const result = await sendSymbolTransfer(account.privateKeyHex, recipient.trim().toUpperCase(), amount, message);
      setTxHash(result.hash);
      setShowPinDialog(false);
      setStep('complete');
      if (fromHome) {
        // These were only staged here as a one-shot handoff from the Home send flow
        // (see SendSymbolAmount.tsx) - clear them now so they don't linger and get
        // reused if the person starts an unrelated send later.
        clearReceiverAddress();
        clearCalculatorFormula();
      }
    } catch (e) {
      console.error('Failed to send Symbol transfer', e);
      setErrorMessage(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  if (step === 'complete') {
    return (
      <Box sx={{ height: '100vh' }}>
        <AppToolBar back="/symbol" title="Send complete" showBack={false} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, px: 3, gap: 2 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 'bold' }}>Your transfer is complete</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, wordBreak: 'break-all', textAlign: 'center' }}>
            トランザクションハッシュ: {txHash}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center' }}>
            承認(ブロックへの取り込み)まで数十秒かかる場合があります。
          </Typography>
          <Button
            variant="contained"
            disableElevation
            onClick={() => navigate(fromHome ? '/top?tab=home' : '/symbol', { replace: true })}
          >
            {fromHome ? 'Back to home' : 'Back to Symbol screen'}
          </Button>
        </Box>
      </Box>
    );
  }

  if (step === 'confirm') {
    return (
      <Box sx={{ height: '100vh' }}>
        <AppToolBar back="/symbol/send" title="Confirm transfer details" onBack={() => setStep('form')} backColor={SYMBOL_VIOLET} />
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <WalletBar isOpened={false} />
          <SymbolHero />

          <Box sx={{ px: 2 }}>
            <Typography sx={{ color: SYMBOL_VIOLET }}>Amount</Typography>
            <Typography sx={{ fontSize: 'large' }}>{amount} XYM</Typography>

            <Typography sx={{ color: SYMBOL_VIOLET, mt: 1 }}>Recipient address</Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>{recipient.trim().toUpperCase()}</Typography>

            {message && (
              <>
                <Typography sx={{ color: SYMBOL_VIOLET, mt: 1 }}>Message</Typography>
                <Typography sx={{ wordBreak: 'break-all' }}>{message}</Typography>
              </>
            )}

            <Typography sx={{ color: SYMBOL_VIOLET, mt: 1 }}>Fee (estimated)</Typography>
            <Typography>
              {estimatedFee === 'loading' ? 'Calculating...' : estimatedFee != null ? `About ${estimatedFee} XYM` : "Couldn't fetch the fee"}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: 'sticky', bottom: 0, maxWidth: 480 }}>
          <AppBar position="static" color="default">
            <Toolbar sx={{ justifyContent: 'center' }}>
              <Typography>{sending ? 'Sending...' : 'Ready to send'}</Typography>
              <IconButton
                disabled={sending}
                onClick={() => setShowPinDialog(true)}
                sx={{ bgcolor: SYMBOL_VIOLET, color: 'white', mx: 1, width: 40, height: 40, '&:hover': { bgcolor: SYMBOL_VIOLET } }}
              >
                <TouchAppIcon fontSize="small" />
              </IconButton>
              <Typography>Enter PIN</Typography>
            </Toolbar>
          </AppBar>
          <Box sx={{ width: '100%', height: 4, bgcolor: SYMBOL_VIOLET }} />
        </Box>

        <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onPassed} />
        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      </Box>
    );
  }

  return (
    <Box>
      <AppToolBar back={fromHome ? '/send/symbol-amount' : '/symbol'} title="Send" backColor={SYMBOL_VIOLET} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <WalletBar isOpened={false} />
        <SymbolHero />

        <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>残高: {balance} XYM</Typography>

          <TextField
            label="Recipient address"
            placeholder="39 characters starting with N"
            fullWidth
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            error={addressError.length > 0}
            helperText={addressError}
            slotProps={{
              input: {
                endAdornment: (
                  <IconButton size="small" onClick={() => setShowScanner(true)} aria-label="Scan a QR code">
                    <QrCodeScannerIcon />
                  </IconButton>
                ),
              },
            }}
          />

          <TextField
            label="Amount (XYM)"
            fullWidth
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountError.length > 0}
            helperText={amountError}
            slotProps={{ input: { endAdornment: <Button size="small" onClick={onSetMax} sx={{ color: SYMBOL_VIOLET }}>Max</Button> } }}
          />

          <TextField
            label="Message (optional)"
            placeholder="This is stored as plain text — encryption isn&apos;t supported."
            fullWidth
            multiline
            minRows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <Button
            variant="contained"
            disableElevation
            size="large"
            onClick={onConfirm}
            sx={{ bgcolor: SYMBOL_VIOLET, '&:hover': { bgcolor: SYMBOL_VIOLET } }}
          >
            次へ
          </Button>
        </Box>
      </Box>

      <Dialog fullScreen open={showScanner} onClose={() => setShowScanner(false)}>
        <Box sx={{ position: 'relative', height: '100%', bgcolor: 'black' }}>
          <IconButton
            onClick={() => setShowScanner(false)}
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
          <Typography align="center" sx={{ color: 'white', position: 'absolute', top: 12, left: 0, right: 0, zIndex: 1 }}>
            送信先のQRコードを読み取ってください
          </Typography>
          {showScanner && (
            <Scanner
              onScan={(results) => { if (results[0]) onDecodeQr(results[0].rawValue); }}
              onError={(error) => setErrorMessage(error instanceof Error ? error.message : String(error))}
            />
          )}
        </Box>
      </Dialog>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
