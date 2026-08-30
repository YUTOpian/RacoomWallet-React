import { useState } from 'react';
import { Box, Card, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import { CustomChainsHelper } from '../../lib/storage';
import { verifyCustomChainRpc } from '../../lib/customChains';

// 設定 > 通貨の取り出し > ＋ から開く、ネットワーク手動追加フォーム。フィールド構成は
// ユーザー提供のスクリーンショット(ネットワーク名/デフォルトのRPC URL/チェーンID/
// 通貨記号/ブロックエクスプローラーURL)に合わせている。追加した内容は
// CustomChainsHelper 経由でローカルに保存され、一覧画面(AssetRecoveryList)からいつでも
// 削除できる。
export default function AssetRecoveryForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [rpcUrl, setRpcUrl] = useState('');
  const [chainId, setChainId] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [blockExplorerUrl, setBlockExplorerUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onSave = async () => {
    const trimmedName = name.trim();
    const trimmedRpc = rpcUrl.trim();
    const trimmedSymbol = currencySymbol.trim();
    const trimmedExplorer = blockExplorerUrl.trim();
    const chainIdNumber = Number(chainId.trim());

    if (trimmedName.length === 0) {
      setErrorMessage(t('asset_recovery.form.error_name_required'));
      return;
    }
    if (trimmedRpc.length === 0) {
      setErrorMessage(t('asset_recovery.form.error_rpc_required'));
      return;
    }
    if (!chainId.trim() || !Number.isInteger(chainIdNumber) || chainIdNumber <= 0) {
      setErrorMessage(t('asset_recovery.form.error_chain_id_invalid'));
      return;
    }
    if (trimmedSymbol.length === 0) {
      setErrorMessage(t('asset_recovery.form.error_symbol_required'));
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const ok = await verifyCustomChainRpc(trimmedRpc, chainIdNumber);
      if (!ok) {
        setErrorMessage(t('asset_recovery.form.error_rpc_verify_failed'));
        return;
      }
      await CustomChainsHelper.add({
        name: trimmedName,
        rpcUrl: trimmedRpc,
        chainId: chainIdNumber,
        currencySymbol: trimmedSymbol,
        blockExplorerUrl: trimmedExplorer,
      });
      navigate('/settings/asset_recovery');
    } catch (e) {
      if (e instanceof Error && e.message === 'duplicate_chain_id') {
        setErrorMessage(t('asset_recovery.form.error_duplicate_chain_id'));
      } else {
        setErrorMessage(t('asset_recovery.form.error_save_failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <AppToolBar back="/settings/asset_recovery" title={t('asset_recovery.form.title')} />
      <Box sx={{ p: 2 }}>
        <Card sx={{ p: 2 }}>
          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 14, mb: 0.5 }}>{t('asset_recovery.form.network_name_label')}</Typography>
            <TextField
              placeholder={t('asset_recovery.form.network_name_placeholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              disabled={submitting}
              autoFocus
            />
          </Box>

          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 14, mb: 0.5 }}>{t('asset_recovery.form.rpc_url_label')}</Typography>
            <TextField
              placeholder={t('asset_recovery.form.add_url_placeholder')}
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              fullWidth
              disabled={submitting}
            />
          </Box>

          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 14, mb: 0.5 }}>{t('asset_recovery.form.chain_id_label')}</Typography>
            <TextField
              placeholder={t('asset_recovery.form.chain_id_placeholder')}
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              fullWidth
              disabled={submitting}
              inputMode="numeric"
            />
          </Box>

          <Box sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 14, mb: 0.5 }}>{t('asset_recovery.form.currency_symbol_label')}</Typography>
            <TextField
              placeholder={t('asset_recovery.form.currency_symbol_placeholder')}
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              fullWidth
              disabled={submitting}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 14, mb: 0.5 }}>{t('asset_recovery.form.explorer_label')}</Typography>
            <TextField
              placeholder={t('asset_recovery.form.add_url_placeholder')}
              value={blockExplorerUrl}
              onChange={(e) => setBlockExplorerUrl(e.target.value)}
              fullWidth
              disabled={submitting}
            />
          </Box>

          {errorMessage && <Alert severity="error" sx={{ mt: 2.5 }}>{errorMessage}</Alert>}
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button variant="contained" color="primary" onClick={onSave} disabled={submitting} sx={{ minWidth: 160 }}>
            {submitting ? <CircularProgress size={20} /> : t('asset_recovery.form.save_button')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
