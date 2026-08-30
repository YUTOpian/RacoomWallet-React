import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useNavigate } from 'react-router-dom';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import { WalletsHelper } from '../../lib/storage';
import { fetchSymbolTransactions } from '../../lib/symbolChain';
import type { SymbolTransactionSummary } from '../../lib/symbolChain';

function truncateAddress(address: string): string {
  const groups = address.match(/.{1,6}/g) ?? [address];
  return groups.join('-');
}

function formatDate(epochMs: number): string {
  if (!epochMs) return '';
  const d = new Date(epochMs);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SymbolTransactionList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [transactions, setTransactions] = useState<SymbolTransactionSummary[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const activeWallet = await WalletsHelper.getActive();
        if (!activeWallet?.symbolAddress) {
          return;
        }
        setAddress(activeWallet.symbolAddress);
        const txs = await fetchSymbolTransactions(activeWallet.symbolAddress, 50);
        setTransactions(txs);
      } catch (e) {
        console.error('Failed to load Symbol transactions', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Box>
      <AppToolBar back="/symbol" title="Transaction history" />
      <WalletBar isOpened={false} showIcon={false} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : transactions.length === 0 ? (
        <Box sx={{ px: 2, mt: 8, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>No transaction history</Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 6, pb: 4 }}>
          {transactions.map((tx, index) => (
            <Box
              key={tx.hash || index}
              onClick={() => navigate('/symbol/transaction/detail', { state: { tx, selfAddress: address } })}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5,
                borderTop: index === 0 ? 'none' : '0.5px solid', borderColor: 'divider', cursor: 'pointer',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {tx.direction === 'out' ? <ArrowUpwardIcon fontSize="small" color="error" /> : <ArrowDownwardIcon fontSize="small" color="success" />}
                <Box>
                  <Typography sx={{ fontSize: 13 }}>{tx.direction === 'out' ? 'Send' : 'Receive'}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#929292' }}>{truncateAddress(tx.counterparty)}</Typography>
                  <Typography sx={{ fontSize: 11, color: '#bdbdbd' }}>{formatDate(tx.timestamp)}</Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 14, color: tx.direction === 'out' ? 'error.main' : 'success.main' }}>
                {tx.direction === 'out' ? '-' : '+'}{tx.amount || '0'} XYM
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
