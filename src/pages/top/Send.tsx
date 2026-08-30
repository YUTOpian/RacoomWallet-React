import { useEffect, useState } from 'react';
import { Box, Card, TextField, IconButton, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';
import { WalletsHelper } from '../../lib/storage';
import { isValidSymbolAddress } from '../../lib/symbolQr';
import { isValidNemAddress } from '../../lib/nemQr';
import { useAppStore } from '../../store/appStore';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import heroSendLarge from '../../assets/heroimage_send_large.png';
import iconAddressbook from '../../assets/icon_addressbook.png';

export default function Send() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setReceiverAddress = useAppStore((s) => s.setReceiverAddress);
  const pickedContactAddress = useAppStore((s) => s.pickedContactAddress);
  const setPickedContactAddress = useAppStore((s) => s.setPickedContactAddress);
  const [address, setAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Picked up after returning from the address-book picker (/addressbook?pick=1) - see
  // AddressBookList's onSelect. Cleared right away so it doesn't get reapplied on a later
  // visit to this tab.
  useEffect(() => {
    if (pickedContactAddress) {
      setAddress(pickedContactAddress);
      setPickedContactAddress('');
    }
  }, [pickedContactAddress, setPickedContactAddress]);

  const onClickedOk = async () => {
    if (!(await WalletsHelper.getActive())) {
      setErrorMessage(t('wallet.not_select_message'));
      return;
    }
    const trimmedAddress: string = address.trim();
    const isEvmAddress = ethers.isAddress(trimmedAddress);
    if (isEvmAddress) {
      setReceiverAddress(trimmedAddress);
      navigate('/send/amount');
      return;
    }

    // Not a valid EVM address - check whether it's a Symbol address instead. The active
    // wallet's Symbol account is derived automatically as soon as a PIN is set/checked
    // (see PinDialog's unlockSymbolIfPossible), so there's no separate "visited Symbol"
    // gate here anymore - a well-formed Symbol address is enough.
    const symbolAddress: string = address.trim().toUpperCase();
    if (isValidSymbolAddress(symbolAddress)) {
      setReceiverAddress(symbolAddress);
      navigate('/send/symbol-amount');
      return;
    }

    // Not a Symbol address either - check whether it's a NEM address instead, the same
    // way as above (NEM's account is likewise derived automatically once a PIN is set/
    // checked - see PinDialog's unlockNemIfPossible).
    const nemAddress: string = address.trim().toUpperCase().replace(/-/g, '');
    if (isValidNemAddress(nemAddress)) {
      setReceiverAddress(nemAddress);
      navigate('/send/nem-amount');
      return;
    }

    setErrorMessage(t('common.invalid_address'));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box component="img" src={heroSendLarge} sx={{ width: '100%' }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2 }}>
        <Typography sx={{ fontSize: 'large' }}>{t('send.destination')}</Typography>
        <Card sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
            <TextField
              id="address"
              label={t('send.input_address')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
              sx={{ mx: 2 }}
            />
            <IconButton onClick={() => navigate('/addressbook?pick=1')} aria-label={t('common.address_book')}>
              <Box component="img" src={iconAddressbook} sx={{ height: '100%' }} />
            </IconButton>
          </Box>
        </Card>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" color="primary" disabled={address.length === 0} onClick={onClickedOk}>OK</Button>
        </Box>
      </Box>
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
