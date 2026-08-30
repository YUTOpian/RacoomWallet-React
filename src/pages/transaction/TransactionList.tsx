import { useEffect, useState } from 'react';
import { Box, Card, CardActionArea, Typography, CircularProgress, Divider, IconButton, Dialog, DialogTitle, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import { useTransactions } from '../../hooks/useTransactions';
import type { TransactionWrapper } from '../../lib/transactionWrapper';
import { useAppStore } from '../../store/appStore';
import { AddressBookHelper, WalletsHelper } from '../../lib/storage';
import { CHAINS } from '../../lib/chains';
import type { ChainKey } from '../../lib/chains';
import emptyImage from '../../assets/image_empty1_large.png';
import iconReceiveGreen from '../../assets/icon_transaction_receive_green.png';
import iconReceiveRed from '../../assets/icon_transaction_receive_red.png';
import iconCheck from '../../assets/icon_transaction_check.png';
import iconUnconfirmed from '../../assets/icon_transaction_unconfirmed.png';
import heroImageTransaction from '../../assets/heroimage_transaction.png';
import { CHAIN_ICONS } from '../../lib/chainIcons';

export default function TransactionList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fetchTransactions } = useTransactions();
  const setTransaction = useAppStore((s) => s.setTransaction);

  const [loading, setLoading] = useState(false);
  const [grouped, setGrouped] = useState<Record<string, TransactionWrapper[]>>({});
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  // Moved here from NavigationDrawer's "Transaction" entry: "view my transactions" isn't
  // indexed/loaded by this wallet on-chain, so it means "open my address on a public
  // block explorer" - opened in the system browser, chosen via this chain picker since
  // the destination URL depends on which chain to look at.
  const [walletAddress, setWalletAddress] = useState('');
  const [chainDialogOpen, setChainDialogOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const wallet = await WalletsHelper.getActive();
      setWalletAddress(wallet?.address ?? '');
    })();
  }, []);

  const openExplorer = (chain: ChainKey) => {
    setChainDialogOpen(false);
    window.open(`${CHAINS[chain].blockExplorerUrl}/address/${walletAddress}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchTransactions(100, true, async (confirmed, unconfirmed) => {
        const all = [...unconfirmed, ...confirmed];
        const next: Record<string, TransactionWrapper[]> = {};
        for (const transaction of all) {
          const key = transaction.dateString;
          (next[key] ??= []).push(transaction);
        }
        setGrouped(next);
        setLoading(false);

        // Resolve every distinct sender/receiver address in the list to an address-book
        // contact name, when one is registered, so rows can show "田中さん" instead of a
        // raw address (see the from/to Typography below) - looked up once per fetch
        // rather than per row.
        const addresses = new Set<string>();
        for (const transaction of all) {
          addresses.add(transaction.senderAddress.toLowerCase());
          addresses.add(transaction.receiverAddress.toLowerCase());
        }
        const entries = await Promise.all(
          [...addresses].map(async (address) => {
            const contact = await AddressBookHelper.findByAddress(address);
            return [address, contact?.name ?? null] as const;
          })
        );
        setPeerNames(Object.fromEntries(entries.filter(([, name]) => name != null) as [string, string][]));
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToDetail = (transaction: TransactionWrapper) => {
    setTransaction(transaction);
    navigate('/transaction/detail');
  };

  const dateKeys = Object.keys(grouped).slice().reverse();

  return (
    <Box>
      <AppToolBar
        back="/top?tab=home"
        title={t('transaction.list_title')}
        actions={
          <IconButton onClick={() => setChainDialogOpen(true)} aria-label={t('common.view_on_explorer')} color="primary">
            <OpenInNewIcon />
          </IconButton>
        }
      />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <WalletBar isOpened={false} />

        {/* Balance card removed in favor of a plain hero banner image. Pulled up so the
            banner overlaps deeply under the WalletBar notch - the notch (zIndex 1) stays
            on top and visible/clickable, only the banner tucks in behind it. */}
        <Box sx={{ px: 2, mt: '-44px' }}>
          <Box
            component="img"
            src={heroImageTransaction}
            alt=""
            sx={{ width: '100%', display: 'block', borderRadius: 1 }}
          />
        </Box>

        <Typography sx={{ mt: 3, px: 2 }}>{t('transaction.jpyc_list_heading')}</Typography>

        {loading ? (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress color="primary" />
          </Box>
        ) : dateKeys.length === 0 ? (
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box component="img" src={emptyImage} sx={{ width: '50%' }} />
            <Typography sx={{ fontSize: 'large', color: 'text.secondary' }}>{t('transaction.no_transaction_title')}</Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {(t('transaction.no_transaction_message', { returnObjects: true }) as string[]).map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </Typography>
          </Box>
        ) : (
          dateKeys.map((dateKey) => (
            <Box key={dateKey}>
              <Divider />
              <Typography sx={{ mt: 1, px: 2 }}>{grouped[dateKey][0].dateString}</Typography>
              <Divider />
              {grouped[dateKey].map((transaction, index) => (
                <Box key={index}>
                  <Card sx={{ m: 1 }} elevation={0}>
                    <CardActionArea onClick={() => goToDetail(transaction)}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', p: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {transaction.chain && (
                            <Box component="img" src={CHAIN_ICONS[transaction.chain]} sx={{ width: 16, height: 16, borderRadius: '50%', mr: 0.5 }} />
                          )}
                          <Box component="img" src={transaction.isReception ? iconReceiveGreen : iconReceiveRed} sx={{ width: 16, height: 16 }} />
                          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, flexGrow: 1 }}>
                            <Typography component="span" sx={{ fontSize: 'large', color: transaction.isReception ? 'primary.main' : 'nemOrange', fontWeight: 'bold' }}>
                              {transaction.isReception ? '+' : '-'}
                            </Typography>
                            <Typography component="span" sx={{ fontSize: 'large', ml: 0.5 }}>
                              {transaction.amount} {transaction.currencySymbol}
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            <Box component="img" src={transaction.isConfirmed ? iconCheck : iconUnconfirmed} sx={{ width: 16, height: 16 }} />
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary', wordBreak: 'break-all' }}>
                          {t('transaction.from_label')}: {peerNames[transaction.senderAddress.toLowerCase()] ?? transaction.senderAddress}
                        </Typography>
                        {peerNames[transaction.senderAddress.toLowerCase()] && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', wordBreak: 'break-all' }}>{transaction.senderAddress}</Typography>
                        )}
                        <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                          {t('transaction.to_label')}: {peerNames[transaction.receiverAddress.toLowerCase()] ?? transaction.receiverAddress}
                        </Typography>
                        {peerNames[transaction.receiverAddress.toLowerCase()] && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', wordBreak: 'break-all' }}>{transaction.receiverAddress}</Typography>
                        )}
                      </Box>
                    </CardActionArea>
                  </Card>
                  {index < grouped[dateKey].length - 1 && <Divider />}
                </Box>
              ))}
            </Box>
          ))
        )}
      </Box>

      <Dialog open={chainDialogOpen} onClose={() => setChainDialogOpen(false)}>
        <DialogTitle>{t('common.select_chain')}</DialogTitle>
        <List sx={{ minWidth: 240, pt: 0 }}>
          {(Object.keys(CHAINS) as ChainKey[]).map((chain) => (
            <ListItemButton key={chain} onClick={() => openExplorer(chain)}>
              <ListItemIcon>
                <Box component="img" src={CHAIN_ICONS[chain]} sx={{ width: 24, height: 24, borderRadius: '50%' }} />
              </ListItemIcon>
              <ListItemText primary={CHAINS[chain].name} />
            </ListItemButton>
          ))}
        </List>
      </Dialog>
    </Box>
  );
}
