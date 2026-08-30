import { useEffect, useState } from 'react';
import { Box, Card, Typography, Divider, Link as MuiLink } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ethers } from 'ethers';
import AppToolBar from '../../components/AppToolBar';
import { TransactionWrapper } from '../../lib/transactionWrapper';
import { CHAINS, getProvider } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import { CHAIN_ICONS } from '../../lib/chainIcons';
import { useAppStore } from '../../store/appStore';
import heroTransactionSmall from '../../assets/heroimage_transaction_small.png';
import iconReceiveGreen from '../../assets/icon_transaction_receive_green.png';
import iconReceiveRed from '../../assets/icon_transaction_receive_red.png';
import iconCheck from '../../assets/icon_transaction_check.png';
import iconUnconfirmed from '../../assets/icon_transaction_unconfirmed.png';

export default function TransactionDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transaction = useAppStore((s) => s.transaction);
  const activeChain = useAppStore((s) => s.activeChain) as ChainKey;
  // Prefer the chain the transaction actually happened on (set for history read from logs);
  // only fall back to whatever chain the app currently has selected for older/edge-case
  // callers that never set it.
  const transactionChain: ChainKey = transaction?.chain ?? activeChain;
  const transactionChainConfig = CHAINS[transactionChain];
  const [feeAmount, setFeeAmount] = useState<string | null>(null);

  useEffect(() => {
    // Fail safe: land here directly (e.g. a stale bookmark) with no transaction selected.
    if (transaction === null || !(transaction instanceof TransactionWrapper)) {
      navigate('/transaction/list', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction]);

  useEffect(() => {
    // The gas fee isn't available from the Transfer log this transaction was found from
    // (see useTransactions.ts), so it's looked up here, once, only for the single
    // transaction being viewed — not for every row in a list.
    if (transaction === null || transaction.feeAmount !== '0') {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const provider = getProvider(transactionChain);
        const receipt = await provider.getTransactionReceipt(transaction.hash);
        if (!receipt || cancelled) return;
        const gasPrice = receipt.gasPrice ?? (await provider.getTransaction(transaction.hash))?.gasPrice;
        if (!gasPrice || cancelled) return;
        const fee = receipt.gasUsed * gasPrice;
        if (!cancelled) setFeeAmount(ethers.formatUnits(fee, transactionChainConfig.nativeCurrency.decimals));
      } catch (e) {
        console.warn('Failed to load transaction fee', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.hash, transactionChain]);

  if (transaction === null) {
    return null;
  }

  const explorerUrl = `${transactionChainConfig.blockExplorerUrl}/tx/${transaction.hash}`;
  const chainIcon = transaction.chain ? CHAIN_ICONS[transaction.chain] : undefined;

  return (
    <Box>
      <AppToolBar back="/transaction/list" title={t('transaction.detail_title')} />
      <Box component="img" src={heroTransactionSmall} sx={{ width: '100%' }} />

      <Card sx={{ m: 1 }} elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {chainIcon && <Box component="img" src={chainIcon} sx={{ width: 16, height: 16, mr: 0.5, borderRadius: '50%' }} />}
            <span>{transaction.dateString} {transaction.timeString}</span>
            <Box sx={{ flexGrow: 1 }} />
            <Typography variant="body2" color="text.secondary">{transactionChainConfig.name}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Box component="img" src={transaction.isReception ? iconReceiveGreen : iconReceiveRed} sx={{ width: 16, height: 16 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, flexGrow: 1 }}>
              <Typography component="span" sx={{ fontSize: 'large', color: transaction.isReception ? 'primary.main' : 'nemOrange', fontWeight: 'bold' }}>
                {transaction.isReception ? '+' : '-'}
              </Typography>
              <Typography component="span" sx={{ fontSize: 'large', ml: 0.5 }}>{transaction.amount} {transaction.currencySymbol}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Box component="img" src={transaction.isConfirmed ? iconCheck : iconUnconfirmed} sx={{ width: 16, height: 16 }} />
            </Box>
          </Box>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>{transaction.peer}</Typography>
        </Box>
      </Card>
      <Divider />

      <Card sx={{ m: 1 }} elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
          <Typography variant="body2" color="text.secondary">From</Typography>
          <Typography sx={{ color: 'primary.main', wordBreak: 'break-all' }}>{transaction.senderAddress}</Typography>
        </Box>
      </Card>
      <Divider />

      <Card sx={{ m: 1 }} elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
          <Typography variant="body2" color="text.secondary">To</Typography>
          <Typography sx={{ color: 'primary.main', wordBreak: 'break-all' }}>{transaction.receiverAddress}</Typography>
        </Box>
      </Card>
      <Divider />

      <Card sx={{ m: 1 }} elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
          <Typography variant="body2" color="text.secondary">Amount: {transaction.amount} {transaction.currencySymbol}</Typography>
          <Typography variant="body2" color="text.secondary">
            Fee: {feeAmount ?? (transaction.feeAmount === '0' ? '…' : transaction.feeAmount)} {transactionChainConfig.nativeCurrency.symbol}
          </Typography>
        </Box>
      </Card>
      <Divider />

      <Card sx={{ m: 1 }} elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
          <Typography variant="body2" color="text.secondary">Hash:</Typography>
          <MuiLink href={explorerUrl} target="_blank" rel="noopener" sx={{ wordBreak: 'break-all' }}>{transaction.hash}</MuiLink>
        </Box>
      </Card>
      <Divider />
    </Box>
  );
}
