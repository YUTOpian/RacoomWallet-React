import { useState, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import PinDialog from '../../components/PinDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { PinCodeHelper, WalletsHelper } from '../../lib/storage';
import { MnemonicHelper } from '../../lib/mnemonic';
import heroSeclessonLarge from '../../assets/heroimage_seclesson_large.png';

const MNEMONIC_LENGTH = 12;
const LOGIN_WALLET_NAME = 'My Wallet';

type Step = 'intro' | 'mnemonic';

export default function LessonLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [words, setWords] = useState<string[]>(Array(MNEMONIC_LENGTH).fill(''));
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinMode, setPinMode] = useState<'register' | 'check'>('register');
  // Separate, automatic "Check PIN" step shown right after the imported wallet is made
  // active. The PIN dialog above (register/check) only unlocks Symbol/NEM for whichever
  // wallet was active *before* it - the newly imported one isn't made active until after
  // that dialog already closed, so a wallet imported here would otherwise stay locked for
  // Symbol/NEM until someone happens to enter their PIN again elsewhere. This mirrors the
  // same pattern used in WalletLoginImport.tsx.
  const [showUnlockPinDialog, setShowUnlockPinDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const wordRefs = useRef<(HTMLInputElement | null)[]>([]);

  const phrase = words.join(' ').trim();
  const isValidPhrase = MnemonicHelper.isValid(phrase);

  const distributeWords = (tokens: string[], startIndex: number) => {
    setWords((prev) => {
      const next = [...prev];
      tokens.forEach((word, i) => {
        if (startIndex + i < MNEMONIC_LENGTH) {
          next[startIndex + i] = word;
        }
      });
      return next;
    });
    const lastIndex = Math.min(startIndex + tokens.length, MNEMONIC_LENGTH - 1);
    wordRefs.current[lastIndex]?.focus();
  };

  const onWordChange = (index: number, value: string) => {
    if (/\s/.test(value)) {
      const tokens = value.split(/\s+/).filter((w) => w.length > 0);
      distributeWords(tokens, index);
      return;
    }
    setWords((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const onWordKeyDown = (index: number, e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && index < MNEMONIC_LENGTH - 1) {
      e.preventDefault();
      wordRefs.current[index + 1]?.focus();
    } else if (e.key === 'Backspace' && words[index] === '' && index > 0) {
      e.preventDefault();
      wordRefs.current[index - 1]?.focus();
    }
  };

  const onWordPaste = (index: number, e: ClipboardEvent<HTMLDivElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (/\s/.test(pasted.trim())) {
      e.preventDefault();
      distributeWords(pasted.trim().split(/\s+/), index);
    }
  };

  const onClickedNext = async () => {
    setPinMode((await PinCodeHelper.hasSavedCode()) ? 'check' : 'register');
    setShowPinDialog(true);
  };

  // Called once the PIN dialog above passes (either a freshly registered PIN, or a
  // confirmed existing one) - creates the wallet from the entered recovery phrase,
  // encrypted with that PIN, and makes it active.
  const createWalletWithPin = async (pinCode: string) => {
    try {
      if (!MnemonicHelper.isValid(phrase)) {
        throw new Error('invalid mnemonic');
      }
      const account = MnemonicHelper.accountFromMnemonic(phrase, 0);
      const wallet = await WalletsHelper.createWithMnemonic(
        LOGIN_WALLET_NAME, account.address, account.publicKey, account.privateKey,
        MnemonicHelper.normalize(phrase), pinCode,
      );
      await WalletsHelper.add(wallet);
      await WalletsHelper.setActive(wallet.id);
      setShowUnlockPinDialog(true);
    } catch {
      setErrorMessage(t('wallet.invalid_key'));
    }
  };

  const goNext = () => navigate('/lesson/login_end');

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {step === 'intro' ? (
        <>
          <AppToolBar back="/lesson/level" title={t('lesson.login_intro_title')} />
          <Box component="img" src={heroSeclessonLarge} sx={{ width: '100%' }} />
          <Box sx={{ mb: 5, mx: 2 }}>
            <Typography align="center">
              {(t('lesson.login_intro_message', { returnObjects: true }) as string[]).map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
            <Button variant="contained" color="primary" size="small" onClick={() => setStep('mnemonic')}>OK</Button>
          </Box>
        </>
      ) : (
        <>
          <AppToolBar onBack={() => setStep('intro')} title={t('lesson.login_import_title')} />
          <Box sx={{ px: 2, pt: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mx: 1 }}>
              {words.map((word, i) => (
                <TextField
                  key={i}
                  inputRef={(el) => { wordRefs.current[i] = el; }}
                  label={t('wallet.import_mnemonic_word_label', { index: i + 1 })}
                  value={word}
                  onChange={(e) => onWordChange(i, e.target.value)}
                  onKeyDown={(e) => onWordKeyDown(i, e)}
                  onPaste={(e) => onWordPaste(i, e)}
                  size="small"
                  slotProps={{ input: { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } }}
                />
              ))}
            </Box>

            {phrase.length > 0 && !isValidPhrase && (
              <Typography align="center" sx={{ color: 'error.main', fontSize: 12, mt: 1 }}>{t('wallet.invalid_key')}</Typography>
            )}

            <Box sx={{ mt: 4, mb: 3 }}>
              <Typography align="center">
                {(t('lesson.login_message', { returnObjects: true }) as string[]).map((line, i) => (
                  <span key={i}>{line}<br /></span>
                ))}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
              <Button variant="contained" color="primary" size="small" disabled={!isValidPhrase} onClick={onClickedNext}>{t('common.pin_settings')}</Button>
            </Box>
          </Box>
        </>
      )}

      <PinDialog open={showPinDialog} mode={pinMode} onClose={() => setShowPinDialog(false)} onPass={createWalletWithPin} />
      <PinDialog
        open={showUnlockPinDialog}
        mode="check"
        onClose={() => setShowUnlockPinDialog(false)}
        // A correct PIN here (checked against the wallet that's now active) makes
        // PinDialog derive and cache both the Symbol and NEM accounts before moving on.
        onPass={goNext}
        // Getting Symbol/NEM working isn't required to finish importing the wallet -
        // if the person cancels here, let them through anyway.
        onCancel={goNext}
      />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
