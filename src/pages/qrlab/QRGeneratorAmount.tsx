import { useState } from 'react';
import { Box, Typography, Button, Avatar, Menu, MenuItem } from '@mui/material';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import Calculator from '../../components/Calculator';
import { CHAINS } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { useAppStore } from '../../store/appStore';
import heroQrLabSmall from '../../assets/heroimage_qr_labo_small.png';

const CHAIN_KEYS = Object.keys(CHAINS) as ChainKey[];

/**
 * QR Lab's 指定金額を受け取る: pick an amount and a chain, then generate a JPYC payment QR
 * for it (see QRGeneratorCollect). JPYC is JPY-pegged 1:1 (see lib/chains.ts), so unlike the
 * app's old XEM-based version of this screen, there's no exchange rate to fetch or XEM/JPY
 * base to toggle between — the amount entered here is the JPYC amount, full stop.
 */
export default function QRGeneratorAmount() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const calculatorFormula = useAppStore((s) => s.calculatorFormula);
  const calculatorValue = useAppStore((s) => s.calculatorValue);
  const activeChain = useAppStore((s) => s.activeChain);
  const [chain, setChain] = useState<ChainKey>(activeChain as ChainKey);
  // Anchor for the chain-picker menu below - same tappable-pill-plus-Menu pattern SwapTop
  // uses for its own chain selector, in place of the old ToggleButtonGroup row.
  const [chainMenuAnchor, setChainMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ height: '100%' }}>
      <AppToolBar back="/top?tab=qrlab" title={t('qrlab.amount_title')} />
      <WalletBar isOpened={false} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box component="img" src={heroQrLabSmall} sx={{ width: '100%' }} />
        <Box sx={{ px: 2 }}>
          <Button
            variant="text"
            fullWidth
            startIcon={<HourglassTopIcon />}
            sx={{ mb: 1 }}
            onClick={() => navigate('/qrlab/pending')}
          >
            {t('qrlab.pending_view')}
          </Button>

          <Typography sx={{ color: 'primary.main' }}>{t('common.amount')}</Typography>
          <Typography sx={{ fontSize: 'x-large' }}>
            {calculatorFormula} JPYC
          </Typography>

          <Typography sx={{ color: 'primary.main', mt: 2, mb: 0.5 }}>{t('marketplace.collect_chain_label')}</Typography>
          <Box
            onClick={(e) => setChainMenuAnchor(e.currentTarget)}
            sx={{
              bgcolor: 'grey.100', borderRadius: 3, px: 2, py: 2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar src={CHAIN_ICONS[chain]} sx={{ width: 32, height: 32 }} />
              <Typography sx={{ fontWeight: 'bold' }}>{CHAINS[chain].name}</Typography>
            </Box>
            <ExpandMoreIcon sx={{ color: 'text.secondary' }} />
          </Box>
          <Menu anchorEl={chainMenuAnchor} open={!!chainMenuAnchor} onClose={() => setChainMenuAnchor(null)}>
            {CHAIN_KEYS.map((key) => (
              <MenuItem
                key={key}
                selected={key === chain}
                onClick={() => { setChain(key); setChainMenuAnchor(null); }}
              >
                <Avatar src={CHAIN_ICONS[key]} sx={{ width: 24, height: 24, mr: 1.5 }} />
                {CHAINS[key].name}
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>
      <Box sx={{ position: 'sticky', bottom: 0 }}>
        <Calculator to={`/qrlab/collect?amount=${calculatorValue}&chain=${chain}`} />
      </Box>
    </Box>
  );
}
