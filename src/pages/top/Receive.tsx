import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, Avatar, Menu, MenuItem } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { QRCodeSVG } from 'qrcode.react';
import { Decimal } from 'decimal.js';
import { useTranslation } from 'react-i18next';
import { WalletsHelper } from '../../lib/storage';
import { CHAINS, getJpycDecimals } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { buildJpycPaymentUri, buildChainLockedAddressUri } from '../../lib/jpycPayment';
import { buildAddressQrPayload } from '../../lib/symbolQr';
import { buildAddressQrPayload as buildNemAddressQrPayload } from '../../lib/nemQr';
import { useAppStore } from '../../store/appStore';
import heroSendSmall from '../../assets/heroimage_send_small.png';
import iconChainSymbol from '../../assets/icon_chain_symbol.png';
import iconChainNem from '../../assets/icon_chain_nem.png';

const CHAIN_KEYS = Object.keys(CHAINS) as ChainKey[];

// Symbol's brand violet - the same swatch used across the Symbol section (SymbolTop,
// SymbolReceive, SymbolSend) so the Symbol QR here reads consistently with the rest of
// that section instead of the app's default teal primary color.
const SYMBOL_VIOLET = '#8239DD';
// NEM's brand blue - the same swatch used across the NEM section (NemTop, NemReceive,
// NemSend) so the NEM QR here reads consistently with the rest of that section.
const NEM_BLUE = '#2F7FCC';

// Every network this screen can generate a receive QR for: one entry per EVM chain
// (Ethereum/Polygon/Avalanche/Kaia - JPYC moves on all four, but as different tokens on
// different chains, so a QR for one must not be scannable as a request on another) plus
// Symbol and NEM, each its own separate asset entirely. Picking a chain here - not just
// "EVM" generically - is what lets the QR itself be chain-locked (see qrValue below /
// buildChainLockedAddressUri), so a sender's wallet can reject or auto-correct a mismatched
// chain instead of silently sending the wrong asset on the wrong network.
type ReceiveMode = ChainKey | 'symbol' | 'nem';

// Ported from src/components/pages/top/Receive.vue, then extended with an optional amount
// and, when this wallet has a derived Symbol/NEM account, a Symbol/NEM QR alongside the EVM
// ones. Entering an amount switches an EVM QR to an EIP-681 ERC-20 transfer request for that
// many JPYC (`ethereum:<JPYC contract>@<chainId>/transfer?address=<addr>&uint256=<amountWei>`,
// see lib/jpycPayment.ts and https://note.com/choconaak/n/n4d44183f1c8b for a worked
// example); leaving it blank still encodes the chosen chain's id (via
// buildChainLockedAddressUri) so the QR is never chain-ambiguous even without an amount.
export default function Receive() {
  const { t } = useTranslation();
  const activeChain = useAppStore((s) => s.activeChain);
  const [address, setAddress] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [decimals, setDecimals] = useState<number | null>(null);

  // Only offered once this wallet's Symbol account has been derived - which now happens
  // automatically as soon as a PIN is set/checked anywhere in the app (see PinDialog's
  // unlockSymbolIfPossible), rather than requiring a visit to the Symbol screen. Until then
  // there's no Symbol address to show a QR for yet, so this option simply doesn't appear.
  const [symbolAddress, setSymbolAddress] = useState<string | null>(null);
  // Same deal as symbolAddress above, but for the NEM account (see lib/nemAccount.ts) - also
  // derived automatically as soon as a PIN is set/checked (PinDialog's unlockNemIfPossible),
  // so this option simply doesn't appear until then either.
  const [nemAddress, setNemAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState('Raccoon Wallet');
  const [mode, setMode] = useState<ReceiveMode>(activeChain);
  // Anchor for the chain/asset picker's dropdown menu - same tappable-card-plus-Menu pattern
  // used on Swap/QR Lab's chain selectors.
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    (async () => {
      const activeWallet = await WalletsHelper.getActive();
      setAddress(activeWallet?.address ?? '');
      setSymbolAddress(activeWallet?.symbolAddress ?? null);
      setNemAddress(activeWallet?.nemAddress ?? null);
      if (activeWallet?.name) setWalletName(activeWallet.name);
    })();
  }, []);

  const amount = useMemo(() => {
    const trimmed = amountInput.trim();
    if (trimmed.length === 0) return null;
    try {
      const value = new Decimal(trimmed);
      return value.greaterThan(0) ? value : null;
    } catch {
      return null;
    }
  }, [amountInput]);

  const isEvmMode = mode !== 'symbol' && mode !== 'nem';
  const chain = isEvmMode ? mode : null;

  // Only look up JPYC's on-chain decimals once an amount is actually entered - a plain
  // chain-locked QR (the common case) shouldn't fire an RPC call for nothing.
  useEffect(() => {
    if (amount === null || chain === null) return;
    let cancelled = false;
    (async () => {
      const value = await getJpycDecimals(chain);
      if (!cancelled) setDecimals(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [amount, chain]);

  const qrValue = chain === null || address.length === 0
    ? address
    : amount !== null && decimals !== null
      ? buildJpycPaymentUri(chain, address, amount, decimals)
      : buildChainLockedAddressUri(chain, address);

  const showSymbolMode = mode === 'symbol' && symbolAddress !== null;
  const showNemMode = mode === 'nem' && nemAddress !== null;

  // Options for the chain/asset picker pill below - one per EVM chain, plus Symbol/NEM only
  // once this wallet actually has an address for them.
  const options: { value: ReceiveMode; icon: string; label: string; color?: string }[] = [
    ...CHAIN_KEYS.map((key) => ({ value: key as ReceiveMode, icon: CHAIN_ICONS[key], label: CHAINS[key].name })),
    ...(symbolAddress !== null ? [{ value: 'symbol' as const, icon: iconChainSymbol, label: 'Symbol', color: SYMBOL_VIOLET }] : []),
    ...(nemAddress !== null ? [{ value: 'nem' as const, icon: iconChainNem, label: 'NEM', color: NEM_BLUE }] : []),
  ];
  const selected = options.find((o) => o.value === mode) ?? options[0];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box component="img" src={heroSendSmall} sx={{ width: '100%' }} />

      <Box sx={{ px: 4, mt: 2 }}>
        <Typography sx={{ fontWeight: 'bold', mb: 1 }}>{t('receive.chain_label')}</Typography>
        <Box
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            bgcolor: 'grey.100', borderRadius: 3, px: 2, py: 2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={selected.icon} sx={{ width: 32, height: 32 }} />
            <Typography sx={{ fontWeight: 'bold', color: selected.color }}>{selected.label}</Typography>
          </Box>
          <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
        </Box>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {options.map((opt) => (
            <MenuItem
              key={opt.value}
              selected={opt.value === mode}
              onClick={() => { setMode(opt.value); setMenuAnchor(null); }}
            >
              <Avatar src={opt.icon} sx={{ width: 24, height: 24, mr: 1.5 }} />
              <Typography sx={{ color: opt.color }}>{opt.label}</Typography>
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {showSymbolMode ? (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3 }}>
            <QRCodeSVG value={buildAddressQrPayload(walletName, symbolAddress)} size={200} />
            <Typography sx={{ mt: 4, color: SYMBOL_VIOLET }}>Your Symbol address</Typography>
            <Typography align="center" sx={{ wordBreak: 'break-all', mx: 4 }}>{symbolAddress}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 4, mx: 4, textAlign: 'center' }}>
            このアドレスはSymbol専用です。他のチェーンの資産を送らないでください。
          </Typography>
        </>
      ) : showNemMode ? (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3 }}>
            <QRCodeSVG value={buildNemAddressQrPayload(walletName, nemAddress)} size={200} />
            <Typography sx={{ mt: 4, color: NEM_BLUE }}>Your NEM address</Typography>
            <Typography align="center" sx={{ wordBreak: 'break-all', mx: 4 }}>{nemAddress}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 4, mx: 4, textAlign: 'center' }}>
            このアドレスはNEM専用です。他のチェーンの資産を送らないでください。
          </Typography>
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
            {address.length > 0 && <QRCodeSVG value={qrValue} size={200} />}
            <Typography sx={{ mt: 4, color: 'primary.main' }}>{t('receive.your_address')}</Typography>
            <Typography align="center" sx={{ wordBreak: 'break-all', mx: 4 }}>{address}</Typography>
          </Box>

          <Box sx={{ px: 4, mt: 4, mb: 4 }}>
            <Typography sx={{ color: 'primary.main', mb: 0.5 }}>{t('receive.amount_label')}</Typography>
            <TextField
              type="number"
              fullWidth
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={t('receive.amount_placeholder')}
              slotProps={{
                htmlInput: { min: 0, step: 'any' },
                input: { endAdornment: <Typography color="text.secondary" sx={{ ml: 1 }}>{t('marketplace.price_unit')}</Typography> },
              }}
            />

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('receive.amount_hint')}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}
