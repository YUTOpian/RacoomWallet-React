import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import AppToolBar from '../../components/AppToolBar';
import type { NemTransactionSummary } from '../../lib/nemChain';

function formatDate(epochMs: number): string {
  if (!epochMs) return 'Unknown';
  const d = new Date(epochMs);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

interface LocationState {
  tx?: NemTransactionSummary;
}

export default function NemTransactionDetail() {
  const location = useLocation();
  const tx = (location.state as LocationState | null)?.tx;

  if (!tx) {
    return (
      <Box>
        <AppToolBar back="/nem/transaction/list" title="Transaction details" />
        <Box sx={{ px: 2, mt: 8, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            取引情報が見つかりませんでした。一覧から開き直してください。
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <AppToolBar back="/nem/transaction/list" title="Transaction details" />
      <Box sx={{ px: 2, mt: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={{ color: 'primary.main' }}>Type</Typography>
        <Typography sx={{ fontSize: 'large' }}>{tx.direction === 'out' ? 'Send' : 'Receive'}</Typography>

        <Typography sx={{ color: 'primary.main', mt: 1 }}>Amount</Typography>
        <Typography sx={{ fontSize: 'large' }}>{tx.amount || '0'} XEM</Typography>

        <Typography sx={{ color: 'primary.main', mt: 1 }}>{tx.direction === 'out' ? 'To' : 'From'}</Typography>
        <Typography sx={{ wordBreak: 'break-all' }}>{tx.counterparty || 'Unknown'}</Typography>

        {tx.message && (
          <>
            <Typography sx={{ color: 'primary.main', mt: 1 }}>Message</Typography>
            <Typography sx={{ wordBreak: 'break-all' }}>{tx.message}</Typography>
          </>
        )}

        <Typography sx={{ color: 'primary.main', mt: 1 }}>Date</Typography>
        <Typography>{formatDate(tx.timestamp)}</Typography>

        <Typography sx={{ color: 'primary.main', mt: 1 }}>Block height</Typography>
        <Typography>{tx.height || 'Unknown'}</Typography>

        <Typography sx={{ color: 'primary.main', mt: 1 }}>Transaction hash</Typography>
        <Typography sx={{ wordBreak: 'break-all', fontSize: 13 }}>{tx.hash}</Typography>
      </Box>
    </Box>
  );
}
