import { useState } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemText, Divider, Switch, Dialog, DialogTitle } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import PinDialog from '../../components/PinDialog';
import MessageDialog from '../../components/MessageDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import { useAppStore } from '../../store/appStore';
import type { AppLanguage } from '../../store/appStore';
import { PinCodeHelper, WalletsHelper } from '../../lib/storage';
import iconListNext from '../../assets/icon_list_next.png';
import heroSettingLarge from '../../assets/heroimage_setting_large.png';

export default function SettingsTop() {
  const { t } = useTranslation();
  // Each language's own name, shown in its own script regardless of the app's current
  // display language (the standard "endonym" pattern - e.g. always "日本語", never a
  // translated word like "Japanese"/"日本語" depending on which language happens to be
  // active right now).
  const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
    { code: 'ja', label: t('settings.language_name_ja') },
    { code: 'en', label: t('settings.language_name_en') },
  ];
  const navigate = useNavigate();
  const networkMode = useAppStore((s) => s.networkMode);
  const setNetworkMode = useAppStore((s) => s.setNetworkMode);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showPinCodeDialog, setShowPinCodeDialog] = useState(false);
  // Second, automatic "Check PIN" step shown right after PINコードの設定・変更 finishes
  // (fresh registration or reset) - mirrors the pattern in WalletCreationName.tsx. The
  // change/registration dialog above already re-encrypts the wallet with the new PIN, but
  // Symbol's account derivation only happens inside PinDialog's own check/register/change
  // handlers when *that* dialog instance sees a correct PIN - so this follow-up "check"
  // dialog, using the very PIN just set, is what actually unlocks Symbol here.
  const [showPinCodeSymbolCheckDialog, setShowPinCodeSymbolCheckDialog] = useState(false);
  const [showDebugModeConfirm, setShowDebugModeConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLogoutPinDialog, setShowLogoutPinDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showNotImplementedYet = () => setErrorMessage(t('common.coming_soon'));

  // Shows the recovery phrase for whichever wallet is currently active - same
  // caution-screen-then-reveal flow as a single wallet's own "Backup" menu item
  // (see WalletSettings.tsx), just reached from the app-wide settings screen instead. No
  // id is passed - WalletBackup already falls back to the active wallet when id is blank -
  // only `back` is set, so both screens' "←"/"完了" return here instead of a (nonexistent)
  // per-wallet settings URL.
  const goToBackup = () => {
    navigate('/wallet/backup_caution?back=/settings/top&mode=mnemonic');
  };

  // Turning testnet mode ON replaces mainnet with Sepolia / Amoy / Kairos / Fuji for the
  // EVM chains (see lib/chains.ts) and with Symbol/NEM's own testnets for those two chains
  // (see lib/symbolChain.ts/lib/nemChain.ts) everywhere in the app - mainnet becomes
  // unreachable until it's turned back off. That's disruptive enough to confirm first.
  // Turning it back OFF just restores normal use, so that direction doesn't need a
  // confirmation step.
  const onDebugModeSwitchChange = () => {
    if (networkMode === 'debug') {
      setNetworkMode('mainnet');
    } else {
      setShowDebugModeConfirm(true);
    }
  };

  const confirmEnableDebugMode = () => {
    setNetworkMode('debug');
    setShowDebugModeConfirm(false);
  };

  // Erases every recovery phrase and private key stored on this device, plus the PIN
  // code itself - keeping the PIN around after logout would let it unlock nothing yet
  // still leak whether the previous user had one set, and would otherwise get reused
  // as the PIN for whatever wallet is set up next. Irreversible without an external
  // backup, so this always goes through a confirmation dialog, and through a PIN check
  // too if one is set (same gate as deleting a single wallet). Lands on /welcome (not
  // /wallet/select) since there's no wallet left to select from at all after this -
  // matches router.tsx's own fallback for the no-wallets case.
  const performLogout = async () => {
    await WalletsHelper.deleteAll();
    await PinCodeHelper.remove();
    navigate('/welcome');
  };

  const onConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    if (await PinCodeHelper.hasSavedCode()) {
      setShowLogoutPinDialog(true);
    } else {
      await performLogout();
    }
  };

  const currentLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.code === language)?.label ?? '';

  const onSelectLanguage = (code: AppLanguage) => {
    setLanguage(code);
    setShowLanguageDialog(false);
  };

  const generalItems = [
    { text: t('settings.language_select'), secondary: currentLanguageLabel, action: () => setShowLanguageDialog(true) },
    { text: t('settings.notification_settings'), secondary: '', action: showNotImplementedYet },
  ];

  return (
    <Box>
      <AppToolBar back="/top?tab=home" title={t('common.settings')} />
      <Box component="img" src={heroSettingLarge} sx={{ width: '100%' }} />

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <List>
          {generalItems.map((item) => (
            <Box key={item.text}>
              <ListItemButton onClick={item.action}>
                <ListItemText primary={item.text} secondary={item.secondary || undefined} />
                <Box component="img" src={iconListNext} sx={{ width: 24 }} />
              </ListItemButton>
              <Divider />
            </Box>
          ))}
          <ListItemButton onClick={() => setShowPinDialog(true)}>
            <ListItemText primary={t('settings.change_password')} />
            <Box component="img" src={iconListNext} sx={{ width: 24 }} />
          </ListItemButton>
          <Divider />
          <ListItemButton onClick={() => setShowPinCodeDialog(true)}>
            <ListItemText primary={t('settings.change_pin')} />
            <Box component="img" src={iconListNext} sx={{ width: 24 }} />
          </ListItemButton>
          <Divider />
          <ListItem>
            <ListItemText primary={t('settings.debug_mode')} />
            <Switch
              checked={networkMode === 'debug'}
              onChange={onDebugModeSwitchChange}
              slotProps={{ input: { 'aria-label': t('settings.debug_mode') } }}
            />
          </ListItem>
          <Divider />
          <ListItemButton onClick={() => navigate('/settings/asset_recovery')}>
            <ListItemText primary={t('asset_recovery.menu_title')} />
            <Box component="img" src={iconListNext} sx={{ width: 24 }} />
          </ListItemButton>
          <Divider />
          <ListItemButton onClick={goToBackup}>
            <ListItemText primary={t('common.backup')} />
            <Box component="img" src={iconListNext} sx={{ width: 24 }} />
          </ListItemButton>
          <Divider />
          <ListItemButton onClick={() => setShowLogoutConfirm(true)}>
            <ListItemText primary={t('settings.logout')} />
            <Box component="img" src={iconListNext} sx={{ width: 24 }} />
          </ListItemButton>
        </List>
      </Box>

      <Dialog open={showLanguageDialog} onClose={() => setShowLanguageDialog(false)}>
        <DialogTitle>{t('settings.language_select')}</DialogTitle>
        <List sx={{ minWidth: 240, pt: 0 }}>
          {LANGUAGE_OPTIONS.map((option) => (
            <ListItemButton key={option.code} selected={option.code === language} onClick={() => onSelectLanguage(option.code)}>
              <ListItemText primary={option.label} />
            </ListItemButton>
          ))}
        </List>
      </Dialog>
      <PinDialog open={showPinDialog} mode="change" onClose={() => setShowPinDialog(false)} onPass={() => setShowPinDialog(false)} />
      {/* Explicit PIN set/reset entry point. PinDialog's mode="change" already branches
          on PinCodeHelper.hasSavedCode() internally - straight to registration when no PIN
          exists yet, check-then-registration (reset) when one does - so this also works as
          a safety net if a bug ever let someone reach Home without a PIN set. Once the new
          PIN is confirmed, a follow-up "Check PIN" dialog opens below to unlock Symbol. */}
      <PinDialog
        open={showPinCodeDialog}
        mode="change"
        onClose={() => setShowPinCodeDialog(false)}
        onPass={() => {
          setShowPinCodeDialog(false);
          setShowPinCodeSymbolCheckDialog(true);
        }}
      />
      <PinDialog
        open={showPinCodeSymbolCheckDialog}
        mode="check"
        onClose={() => setShowPinCodeSymbolCheckDialog(false)}
        onCancel={() => setShowPinCodeSymbolCheckDialog(false)}
        onPass={() => setShowPinCodeSymbolCheckDialog(false)}
      />
      <MessageDialog
        open={showDebugModeConfirm}
        title={t('settings.debug_mode')}
        texts={[t('settings.debug_mode_confirm_1'), t('settings.debug_mode_confirm_2')]}
        selectable
        onClose={confirmEnableDebugMode}
        onCancel={() => setShowDebugModeConfirm(false)}
      />
      <MessageDialog
        open={showLogoutConfirm}
        title={t('settings.logout_confirm_title')}
        texts={t('settings.logout_confirm_message', { returnObjects: true }) as string[]}
        selectable
        onClose={onConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      <PinDialog
        open={showLogoutPinDialog}
        mode="check"
        onClose={() => setShowLogoutPinDialog(false)}
        onCancel={() => setShowLogoutPinDialog(false)}
        onPass={performLogout}
      />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
