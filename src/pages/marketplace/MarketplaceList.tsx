import { useCallback, useEffect, useState } from 'react';
import { Box, List, ListItemButton, ListItemText, Chip, Divider, Typography, Fab, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import { ProductsHelper } from '../../lib/storage';
import type { ProductRecord } from '../../lib/storage';
import heroQrLabSmall from '../../assets/heroimage_qr_labo_small.png';

// The "売り物リスト" home screen: a manual-accounting + inventory tool for selling a small
// set of items (event goods, NFTs, whatever). Shows 📋 売り物一覧 (the product list itself,
// with 🔴 在庫切れ called out per-row), same as AddressBookList is the home screen for the
// address book feature. Full sales history (across every product, with delete/clear) lives
// on MarketplaceSalesHistory.
export default function MarketplaceList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await ProductsHelper.list();
    setProducts(list);
    setLoading(false);
  }, []);

  // Re-loaded every time this screen becomes visible (not just on first mount) so a sale
  // recorded on MarketplaceCollect is reflected here immediately when navigating back.
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <Box>
      <AppToolBar
        back="/top?tab=qrlab"
        onBack={() => navigate('/top?tab=qrlab')}
        title={t('marketplace.title')}
        actions={
          <IconButton aria-label={t('marketplace.view_sales_history')} onClick={() => navigate('/marketplace/history')}>
            <HistoryIcon />
          </IconButton>
        }
      />
      <Box component="img" src={heroQrLabSmall} sx={{ width: '100%', display: 'block' }} />

      {!loading && products.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 6, px: 4 }}>
          <Typography align="center" color="text.secondary">{t('marketplace.empty_message')}</Typography>
        </Box>
      ) : (
        <List sx={{ pt: 0 }}>
          {products.map((product, i) => (
            <Box key={product.id}>
              <ListItemButton onClick={() => navigate(`/marketplace/detail?id=${product.id}`)} sx={{ py: 1.5 }}>
                <ListItemText
                  primary={product.name}
                  secondary={`${product.price.toLocaleString()} ${t('marketplace.price_unit')}`}
                />
                {product.stock <= 0 ? (
                  <Chip size="small" color="error" label={t('marketplace.out_of_stock')} />
                ) : (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${t('marketplace.stock')} ${product.stock}${t('marketplace.stock_unit')}`}
                  />
                )}
              </ListItemButton>
              {i < products.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      )}

      <Fab
        color="primary"
        aria-label={t('common.add')}
        onClick={() => navigate('/marketplace/form')}
        sx={{ position: 'fixed', right: 24, bottom: 24 }}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}
