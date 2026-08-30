import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Divider, Typography, Avatar } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletsHelper, AddressBookHelper } from '../lib/storage';
import type { AddressBookRecord } from '../lib/storage';
import ErrorSnackbar from './ErrorSnackbar';
import menuBackground from '../assets/image_menu_default.png';
import logoPyoko from '../assets/logo_pyoko.png';
import iconMenuHome from '../assets/icon_menu_home.png';
import iconMenuSymbol from '../assets/icon_menu_symbol.png';
import iconMenuNem from '../assets/icon_menu_nem.png';
import iconMenuAbout from '../assets/icon_menu_about.png';
import iconMenuSetting from '../assets/icon_menu_setting.png';

interface NavigationDrawerProps {
  open: boolean;
  onClose: () => void;
}

// Ported from src/components/parts/NavigationDrawer.vue.
export default function NavigationDrawer({ open, onClose }: NavigationDrawerProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [walletName, setWalletName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // The person's own address-book profile (see pages/addressbook/AddressBookDetail's
  // ?id=self mode / the original app's "自分のプロフィール設定") - if they've set a name
  // or icon there, it's shown alongside the active wallet below instead of the default
  // raccoon mascot + "GUEST", matching the original app's drawer header.
  const [selfProfile, setSelfProfile] = useState<AddressBookRecord | null>(null);

  useEffect(() => {
    (async () => {
      const wallet = await WalletsHelper.getActive();
      if (wallet === null) {
        setWalletName(t('common.not_select'));
        setWalletAddress('');
      } else {
        setWalletName(wallet.name);
        setWalletAddress(wallet.address);
      }
    })();
  }, [t]);

  // Reloaded every time the drawer opens so an edit made on the self-profile screen
  // (accessed by tapping this same header) shows up immediately next time it's opened.
  useEffect(() => {
    if (!open) return;
    (async () => setSelfProfile(await AddressBookHelper.getSelf()))();
  }, [open]);

  const hasCustomSelfProfile = selfProfile !== null && (selfProfile.name !== 'GUEST' || selfProfile.iconDataUrl.length > 0);

  const items: ({ title: string; icon: string | ReactNode; action: () => void } | null)[] = [
    { title: 'Home', icon: iconMenuHome, action: onClose },
    { title: 'Symbol', icon: iconMenuSymbol, action: () => navigate('/symbol') },
    { title: 'NEM', icon: iconMenuNem, action: () => navigate('/nem') },
    null,
    { title: 'About', icon: iconMenuAbout, action: () => navigate('/about') },
    { title: t('common.settings'), icon: iconMenuSetting, action: () => navigate('/settings/top') },
  ];

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: 280, bgcolor: '#212121', color: 'white', height: '100%' }}>
        <Box
          onClick={() => { onClose(); navigate(`/addressbook/detail?id=${AddressBookHelper.SELF_ID}`); }}
          sx={{
            position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center',
            // minHeight (not a fixed height) so the box can grow past its old 96px when the
            // wallet name + full address need two lines to fit - a fixed height clipped the
            // address right at the edge instead. The background photo still covers however
            // tall that ends up being, same as before.
            minHeight: 96, py: 2, px: 2,
            backgroundImage: `url(${hasCustomSelfProfile && selfProfile?.coverDataUrl ? selfProfile.coverDataUrl : menuBackground})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        >
          {/* The mascot icon is shown whenever no custom photo is set - not just before the
             self-profile has ever been touched - so removing a previously-set icon (while
             keeping a custom name) reverts back to it instead of falling through to a bare
             person silhouette. */}
          <Avatar
            src={hasCustomSelfProfile && selfProfile?.iconDataUrl ? selfProfile.iconDataUrl : undefined}
            sx={{ width: 56, height: 56, bgcolor: hasCustomSelfProfile && selfProfile?.iconDataUrl ? 'grey.400' : 'transparent', flexShrink: 0 }}
          >
            {!(hasCustomSelfProfile && selfProfile?.iconDataUrl) && (
              <Box component="img" src={logoPyoko} sx={{ width: '75%' }} />
            )}
          </Avatar>
          <Box sx={{ ml: 1, minWidth: 0 }}>
            {/* text-shadow so name/wallet/address stay legible over a busy background photo. */}
            <Typography sx={{ fontSize: 'x-large', textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}>{hasCustomSelfProfile ? selfProfile?.name : 'GUEST'}</Typography>
            <Typography variant="body2" sx={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}>{walletName}</Typography>
            <Typography variant="caption" sx={{ wordBreak: 'break-all', textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}>{walletAddress}</Typography>
          </Box>
        </Box>
        <List>
          {items.map((item, i) =>
            item === null ? (
              <Divider key={i} sx={{ bgcolor: 'grey.700' }} />
            ) : (
              <ListItemButton key={item.title} onClick={item.action}>
                <ListItemIcon>
                  {typeof item.icon === 'string' ? (
                    <Box component="img" src={item.icon} sx={{ width: 24 }} />
                  ) : (
                    item.icon
                  )}
                </ListItemIcon>
                <ListItemText primary={item.title} sx={{ color: 'white' }} />
              </ListItemButton>
            )
          )}
        </List>
      </Box>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Drawer>
  );
}
