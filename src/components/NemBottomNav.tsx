import { BottomNavigation, BottomNavigationAction } from '@mui/material';
import EnergySavingsLeafOutlinedIcon from '@mui/icons-material/EnergySavingsLeafOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import { useNavigate } from 'react-router-dom';

export type NemBottomNavKey = 'harvest' | 'backup';

interface NemBottomNavProps {
  active: NemBottomNavKey | null;
  // Same shape/role as SymbolBottomNav's onHarvestClick: callers navigate to the real
  // ハーベスト設定 screen (pages/nem/NemHarvest.tsx). Kept as a prop (rather than the bar
  // navigating directly) so both bars stay easy to keep in sync.
  onHarvestClick: () => void;
  hideOther?: boolean;
}

const labelSx = {
  '& .MuiBottomNavigationAction-label': {
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    '&.Mui-selected': { fontSize: '0.75rem' },
  },
};

export default function NemBottomNav({ active, onHarvestClick, hideOther = false }: NemBottomNavProps) {
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
          onClick={() => navigate('/nem/backup')}
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

export const NEM_BOTTOM_NAV_HEIGHT = 56;
