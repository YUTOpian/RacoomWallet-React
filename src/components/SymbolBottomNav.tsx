import { BottomNavigation, BottomNavigationAction } from '@mui/material';
import EnergySavingsLeafOutlinedIcon from '@mui/icons-material/EnergySavingsLeafOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { useNavigate } from 'react-router-dom';

export type SymbolBottomNavKey = 'harvest' | 'backup';

interface SymbolBottomNavProps {
  active: SymbolBottomNavKey | null;
  // Callers navigate to /symbol/harvest (see SymbolTop/SymbolBackup) - SymbolHarvest itself
  // passes a no-op here since tapping "Harvest" while already on that screen does nothing.
  onHarvestClick: () => void;
  // While inside ハーベスト設定 or バックアップ themselves, the *other* section's button is
  // hidden entirely rather than just disabled - e.g. tapping "Backup" from the harvest
  // screen mid-setup (node picked, PIN dialog open, tx in flight...) has no safe meaning, so
  // the affordance to leave via the bottom bar is removed rather than merely blocked. Only
  // relevant while `active` is 'harvest' or 'backup' - SymbolTop (active=null) always shows
  // both, since neither sub-flow is in progress there.
  hideOther?: boolean;
}

const labelSx = {
  '& .MuiBottomNavigationAction-label': {
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    '&.Mui-selected': { fontSize: '0.75rem' },
  },
};

// Symbol section's own bottom bar - distinct from the app-wide BottomNav (QR Lab/SWAP/
// HOME/TOKEN/ADDRESS), since ハーベスト/バックアップ only make sense while inside the
// Symbol (XYM) area. Shared by SymbolTop and SymbolBackup so the section doesn't lose its
// own navigation once you've drilled into バックアップ.
export default function SymbolBottomNav({ active, onHarvestClick, hideOther = false }: SymbolBottomNavProps) {
  const navigate = useNavigate();
  const hideHarvest = hideOther && active === 'backup';
  const hideBackup = hideOther && active === 'harvest';

  return (
    <BottomNavigation
      value={active}
      showLabels
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, px: 1, py: 0.5 }}
    >
      {!hideHarvest && (
        <BottomNavigationAction
          label="Harvest"
          value="harvest"
          onClick={onHarvestClick}
          icon={<EnergySavingsLeafOutlinedIcon sx={{ fontSize: 26 }} />}
          sx={{
            minWidth: 0,
            mx: 0.5,
            borderRadius: 999,
            color: active === 'harvest' ? 'primary.main' : 'text.disabled',
            bgcolor: active === 'harvest' ? 'rgba(0, 195, 178, 0.1)' : 'transparent',
            ...labelSx,
          }}
        />
      )}
      {!hideBackup && (
        <BottomNavigationAction
          label="Backup"
          value="backup"
          onClick={() => navigate('/symbol/backup')}
          icon={<KeyOutlinedIcon sx={{ fontSize: 26 }} />}
          sx={{
            minWidth: 0,
            mx: 0.5,
            borderRadius: 999,
            color: active === 'backup' ? 'primary.main' : 'text.disabled',
            bgcolor: active === 'backup' ? 'rgba(0, 195, 178, 0.1)' : 'transparent',
            ...labelSx,
          }}
        />
      )}
    </BottomNavigation>
  );
}

// Re-exported so callers can add bottom padding that matches this bar's height (mirrors
// BOTTOM_NAV_HEIGHT usage alongside the app-wide BottomNav, e.g. in AddressBookList).
export const SYMBOL_BOTTOM_NAV_HEIGHT = 56;
