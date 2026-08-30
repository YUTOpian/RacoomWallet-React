import { useCallback, useEffect, useState } from 'react';
import {
  Box, Card, Typography, Button, IconButton, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Fab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import { WalletsHelper, CustomChainsHelper, CustomTokensHelper } from '../../lib/storage';
import type { CustomChainRecord, CustomTokenRecord } from '../../lib/storage';
import type { TokenBalance } from '../../lib/chains';
import {
  fetchCustomChainNativeBalance, fetchCustomChainTokenBalance, fetchCustomChainTokenMetadata,
} from '../../lib/customChains';

type ChainState = { nativeBalance: string; tokens: TokenBalance[] };

// 設定 > 全般 > デバッグモード の下にある「通貨の取り出し」から入る画面。対応チェーン
// (Ethereum/Polygon/Kaia/Avalanche)以外に誤って送ってしまった資産を確認するための救済
// 機能で、ウォレットの正式な対応チェーンを増やすものではない — 送金機能とは接続しない。
export default function AssetRecoveryList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [chains, setChains] = useState<CustomChainRecord[]>([]);
  const [states, setStates] = useState<Record<string, ChainState>>({});
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const activeWallet = await WalletsHelper.getActive();
    setAddress(activeWallet?.address ?? null);
    const list = await CustomChainsHelper.list();
    setChains(list);
    if (activeWallet) {
      const entries = await Promise.all(list.map(async (chain) => {
        const customTokens = await CustomTokensHelper.list(chain.id);
        const [nativeBalance, tokens] = await Promise.all([
          fetchCustomChainNativeBalance(chain.rpcUrl, activeWallet.address).catch(() => '0'),
          Promise.all(customTokens.map((t) =>
            fetchCustomChainTokenBalance(chain.rpcUrl, t, activeWallet.address).catch(() => ({ ...t, balance: '0' })),
          )),
        ]);
        return [chain.id, { nativeBalance, tokens }] as const;
      }));
      setStates(Object.fromEntries(entries));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- 削除確認 -------------------------------------------------------------------
  const [deleteTarget, setDeleteTarget] = useState<CustomChainRecord | null>(null);
  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    await CustomChainsHelper.remove(deleteTarget.id);
    setDeleteTarget(null);
    await load();
  };

  // --- トークンを追加ダイアログ ------------------------------------------------------
  const [tokenDialogChain, setTokenDialogChain] = useState<CustomChainRecord | null>(null);
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const openTokenDialog = (chain: CustomChainRecord) => {
    setTokenDialogChain(chain);
    setTokenAddress('');
    setTokenError(null);
  };

  const onSubmitToken = async () => {
    if (!tokenDialogChain || !address) return;
    const value = tokenAddress.trim();
    if (value.length === 0) {
      setTokenError(t('asset_recovery.error_contract_address_required'));
      return;
    }
    setTokenSubmitting(true);
    setTokenError(null);
    try {
      const meta = await fetchCustomChainTokenMetadata(tokenDialogChain.rpcUrl, value);
      const record: CustomTokenRecord = { chain: tokenDialogChain.id, ...meta };
      await CustomTokensHelper.add(record);
      setTokenDialogChain(null);
      await load();
    } catch {
      setTokenError(t('asset_recovery.error_token_fetch_failed'));
    } finally {
      setTokenSubmitting(false);
    }
  };

  const onRemoveToken = async (chain: CustomChainRecord, token: TokenBalance) => {
    await CustomTokensHelper.remove(chain.id, token.address);
    await load();
  };

  return (
    <Box>
      <AppToolBar back="/settings/top" title={t('asset_recovery.list_title')} />
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('asset_recovery.info_alert')}
        </Alert>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : chains.length === 0 ? (
          <Typography align="center" color="text.secondary" sx={{ mt: 6 }}>
            {t('asset_recovery.empty_state')}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {chains.map((chain) => {
              const state = states[chain.id];
              return (
                <Card key={chain.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 2 }}>
                    <Typography sx={{ color: '#929292', fontWeight: 'bold' }}>
                      {chain.name}{t('asset_recovery.chain_id_suffix', { chainId: chain.chainId })}
                    </Typography>
                    <IconButton size="small" aria-label={t('asset_recovery.remove_network')} onClick={() => setDeleteTarget(chain)}>
                      <CloseIcon fontSize="small" sx={{ color: '#929292' }} />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: '#929292', fontSize: 12 }}>{chain.currencySymbol}</Typography>
                      <Typography sx={{ fontSize: 'large' }}>{state?.nativeBalance ?? '0.0'}</Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate(`/settings/asset_recovery/send?chain=${chain.id}&token=native`)}
                    >
                      {t('asset_recovery.send_button')}
                    </Button>
                  </Box>

                  {state?.tokens.map((token) => (
                    <Box
                      key={token.address}
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'grey.200' }}
                    >
                      <Box>
                        <Typography sx={{ color: '#929292', fontSize: 12 }}>{token.symbol}</Typography>
                        <Typography sx={{ fontSize: 'large' }}>{token.balance}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => navigate(`/settings/asset_recovery/send?chain=${chain.id}&token=${token.address}`)}
                        >
                          {t('asset_recovery.send_button')}
                        </Button>
                        <IconButton size="small" aria-label={t('asset_recovery.remove_token')} onClick={() => onRemoveToken(chain, token)}>
                          <CloseIcon fontSize="small" sx={{ color: '#929292' }} />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}

                  <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'grey.200' }}>
                    <Button
                      size="small"
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={() => openTokenDialog(chain)}
                      sx={{ color: '#929292' }}
                    >
                      {t('asset_recovery.add_token_button')}
                    </Button>
                  </Box>

                  {chain.blockExplorerUrl && (
                    <Box sx={{ px: 2, pb: 1.5 }}>
                      <Typography
                        component="a"
                        href={chain.blockExplorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ fontSize: 12, color: 'primary.main' }}
                      >
                        {t('common.view_on_explorer')}
                      </Typography>
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      <Fab
        color="primary"
        aria-label={t('asset_recovery.add_network_aria')}
        onClick={() => navigate('/settings/asset_recovery/add')}
        sx={{ position: 'fixed', right: 24, bottom: 24 }}
      >
        <AddIcon />
      </Fab>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('asset_recovery.delete_confirm_title', { name: deleteTarget?.name })}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button onClick={onConfirmDelete} color="error">{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={tokenDialogChain !== null} onClose={() => !tokenSubmitting && setTokenDialogChain(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('asset_recovery.add_token_dialog_title')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: 'small', mb: 2 }}>
            {t('asset_recovery.token_helper_text', { name: tokenDialogChain?.name })}
          </Typography>
          <TextField
            label={t('asset_recovery.contract_address_label')}
            placeholder="0x..."
            fullWidth
            margin="dense"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            disabled={tokenSubmitting}
            autoFocus
          />
          {tokenError && <Alert severity="error" sx={{ mt: 2 }}>{tokenError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTokenDialogChain(null)} disabled={tokenSubmitting}>{t('common.cancel')}</Button>
          <Button onClick={onSubmitToken} variant="contained" disabled={tokenSubmitting}>
            {tokenSubmitting ? <CircularProgress size={20} /> : t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
