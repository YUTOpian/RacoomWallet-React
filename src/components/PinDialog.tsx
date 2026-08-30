import { useState, useEffect, useCallback } from 'react';
import { Dialog, Box, IconButton, Typography, Card, CardActionArea } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import { useTranslation } from 'react-i18next';
import { PinCodeHelper, WalletsHelper } from '../lib/storage';
import { SymbolAccountHelper } from '../lib/symbolAccount';
import { NemAccountHelper } from '../lib/nemAccount';
import MessageDialog from './MessageDialog';

type PinMode = 'check' | 'register' | 'change';
type PinState = 'check' | 'registration' | 'confirmation';

interface PinDialogProps {
  open: boolean;
  mode?: PinMode;
  onClose: () => void;
  onPass: (pin: string) => void;
  onCancel?: () => void;
}

const INPUT_SIZE = 48;
const H_MARGIN = 8;
const V_MARGIN = 4;

/**
 * Ported from src/components/parts/PinDialog.vue. Behavior (check / register / change
 * flows, retry-on-mismatch, wallet re-encryption on change) is kept identical — only the
 * rendering layer moved from Vuetify to MUI.
 *
 * Also doubles as the single place that unlocks Symbol (XYM) for the active wallet: any
 * time a correct PIN becomes known here - a successful "Check PIN", a freshly registered
 * PIN, or a freshly changed one - unlockSymbolIfPossible derives and caches that wallet's
 * Symbol account, so the person never has to separately open the Symbol screen and enter
 * their PIN there just to unlock it.
 */
export default function PinDialog({ open, mode = 'check', onClose, onPass, onCancel }: PinDialogProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [state, setState] = useState<PinState>('check');
  const [registeredPin, setRegisteredPin] = useState('');
  const [oldPin, setOldPin] = useState('');
  const [showRegistrationInfo, setShowRegistrationInfo] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showRetryError, setShowRetryError] = useState(false);

  const initializeState = useCallback(async () => {
    if (mode === 'check') {
      setState('check');
    } else if (mode === 'register') {
      setState('registration');
    } else if (mode === 'change') {
      setState((await PinCodeHelper.hasSavedCode()) ? 'check' : 'registration');
    }
    setOldPin('');
    setRegisteredPin('');
    setInput('');
  }, [mode]);

  useEffect(() => {
    if (open) {
      setShowRegistrationInfo(mode === 'register');
      initializeState();
    }
  }, [open, mode, initializeState]);

  const retry = () => {
    setShowRetryError(true);
    setInput('');
  };

  // Derives and caches the active wallet's Symbol account as soon as a correct PIN
  // becomes known, instead of making the person visit the Symbol screen and unlock it
  // there separately. Called after every successful PIN check, registration, or change
  // (see onClickedCode below) - a no-op once the wallet already has a cached Symbol
  // address, and silently skipped (rather than surfaced as an error) if anything about
  // the derivation fails, since this dialog's own success/failure UI is about the PIN
  // itself, not about Symbol.
  const unlockSymbolIfPossible = useCallback(async (pin: string) => {
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet || activeWallet.symbolAddress) {
        return;
      }
      const privateKey = await WalletsHelper.decryptKey(activeWallet.id, pin);
      if (!privateKey) {
        return;
      }
      const account = SymbolAccountHelper.fromPrivateKey(privateKey);
      await WalletsHelper.cacheSymbolAccount(activeWallet.id, account.address, account.publicKey);
    } catch (e) {
      console.error('Failed to unlock Symbol account after PIN entry', e);
    }
  }, []);

  // Same as unlockSymbolIfPossible above, but for the NEM (XEM) account (see
  // lib/nemAccount.ts). Kept as a separate function/cache field from Symbol's since the
  // two are unrelated derived accounts, even though the flow is identical.
  const unlockNemIfPossible = useCallback(async (pin: string) => {
    try {
      const activeWallet = await WalletsHelper.getActive();
      if (!activeWallet || activeWallet.nemAddress) {
        return;
      }
      const privateKey = await WalletsHelper.decryptKey(activeWallet.id, pin);
      if (!privateKey) {
        return;
      }
      const account = NemAccountHelper.fromPrivateKey(privateKey);
      await WalletsHelper.cacheNemAccount(activeWallet.id, account.address, account.publicKey);
    } catch (e) {
      console.error('Failed to unlock NEM account after PIN entry', e);
    }
  }, []);

  const closeView = async (finalInput: string) => {
    onClose();
    onPass(finalInput);
    await initializeState();
  };

  const cancel = async () => {
    setInput('');
    onClose();
    onCancel?.();
    await initializeState();
  };

  // Removes the last entered digit, so a mistyped digit can be corrected without having
  // to wait for the 6-digit auto-submit to fail and clear the whole entry via retry().
  // A no-op while input is already empty.
  const onClickedBackspace = () => {
    setInput((prev) => prev.slice(0, -1));
  };

  const onClickedCode = async (code: number) => {
    const next = input + code.toString();
    setInput(next);

    if (next.length < 6) {
      return;
    }

    if (mode === 'check') {
      if (await PinCodeHelper.check(next)) {
        await unlockSymbolIfPossible(next);
        await unlockNemIfPossible(next);
        await closeView(next);
      } else {
        retry();
      }
    } else if (mode === 'register') {
      if (state === 'registration') {
        setRegisteredPin(next);
        setInput('');
        setState('confirmation');
      } else {
        if (registeredPin === next) {
          // Same as the 'change' branch below: encryptWallets can fail (e.g. if the
          // active wallet's secret isn't actually encrypted with defaultPin, which can
          // happen if a PIN was set in an earlier session/build and only the saved PIN
          // record was cleared without re-encrypting the wallet back to defaultPin). The
          // return value must be checked here too - previously it was ignored, so
          // PinCodeHelper.update(next) ran unconditionally and the saved PIN diverged
          // from the wallet's actual encryption password. That left the wallet
          // permanently undecryptable with the "new" PIN, and made Symbol/NEM unlocking
          // fail silently right afterward, since unlockSymbolIfPossible/
          // unlockNemIfPossible also try to decrypt with `next`.
          if (await WalletsHelper.encryptWallets(PinCodeHelper.defaultPin, next)) {
            await PinCodeHelper.update(next);
            await unlockSymbolIfPossible(next);
            await unlockNemIfPossible(next);
            setShowSuccess(true);
          } else {
            await cancel();
          }
        } else {
          retry();
        }
      }
    } else if (mode === 'change') {
      if (state === 'check') {
        if (await PinCodeHelper.check(next)) {
          setOldPin(next);
          await unlockSymbolIfPossible(next);
          await unlockNemIfPossible(next);
          setInput('');
          setState('registration');
        } else {
          retry();
        }
      } else if (state === 'registration') {
        setRegisteredPin(next);
        setInput('');
        setState('confirmation');
      } else {
        if (registeredPin === next) {
          const effectiveOldPin = (await PinCodeHelper.hasSavedCode()) ? oldPin : PinCodeHelper.defaultPin;
          if (await WalletsHelper.encryptWallets(effectiveOldPin, next)) {
            await PinCodeHelper.update(next);
            await unlockSymbolIfPossible(next);
            await unlockNemIfPossible(next);
            setShowSuccess(true);
          } else {
            await cancel();
          }
        } else {
          retry();
        }
      }
    }
  };

  const stateLabel = state === 'check' ? 'Check PIN' : state === 'registration' ? 'Enter PIN' : 'Confirm PIN';

  return (
    <Dialog fullScreen open={open} onClose={cancel}>
      <Box sx={{ bgcolor: 'primary.main', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2 }}>
        <IconButton onClick={cancel} sx={{ alignSelf: 'flex-start', ml: 1 }}>
          <ArrowBackIcon sx={{ color: 'white' }} />
        </IconButton>
        <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: 'large', mt: 1 }}>{stateLabel}</Typography>
        <Box sx={{ display: 'flex', mb: 2, mt: 1 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Box
              key={i}
              sx={{
                width: 12, height: 12, borderRadius: '4px', border: '2px solid white',
                mx: '3px', bgcolor: i <= input.length ? 'white' : 'transparent',
              }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', width: (INPUT_SIZE + H_MARGIN * 2) * 3 }}>
          {/* Standard phone-keypad order: 1-9, then an empty slot, 0, and backspace on
              the last row - so 0 stays centered and backspace sits where a person
              reaching for "undo the last digit" instinctively expects it. */}
          {([1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'backspace'] as const).map((key, i) => {
            if (key === null) {
              return <Box key={`blank-${i}`} sx={{ width: INPUT_SIZE, height: INPUT_SIZE, my: `${V_MARGIN}px`, mx: `${H_MARGIN}px` }} />;
            }
            if (key === 'backspace') {
              return (
                <Card key="backspace" sx={{ my: `${V_MARGIN}px`, mx: `${H_MARGIN}px`, bgcolor: 'transparent' }} elevation={0}>
                  <CardActionArea
                    onClick={onClickedBackspace}
                    disabled={input.length === 0}
                    sx={{
                      width: INPUT_SIZE, height: INPUT_SIZE, borderRadius: '10px', border: '2px solid white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: input.length === 0 ? 0.4 : 1,
                    }}
                  >
                    <BackspaceOutlinedIcon sx={{ color: 'white' }} />
                  </CardActionArea>
                </Card>
              );
            }
            return (
              <Card key={key} sx={{ my: `${V_MARGIN}px`, mx: `${H_MARGIN}px`, bgcolor: 'transparent' }} elevation={0}>
                <CardActionArea
                  onClick={() => onClickedCode(key)}
                  sx={{
                    width: INPUT_SIZE, height: INPUT_SIZE, borderRadius: '10px', border: '2px solid white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ color: 'white', fontSize: 'large' }}>{key}</Typography>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Box>

      <MessageDialog
        open={showRegistrationInfo}
        title={t('common.pin_settings')}
        texts={t('common.pin_registration_message', { returnObjects: true }) as string[]}
        onClose={() => setShowRegistrationInfo(false)}
      />
      <MessageDialog
        open={showSuccess}
        title={t('common.success')}
        texts={t('common.pin_registration_complete', { returnObjects: true }) as string[]}
        onClose={() => { setShowSuccess(false); closeView(input); }}
      />
      <MessageDialog
        open={showRetryError}
        title={t('common.error')}
        texts={t('common.pin_retry', { returnObjects: true }) as string[]}
        onClose={() => setShowRetryError(false)}
        variant="error"
      />
    </Dialog>
  );
}
