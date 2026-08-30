import { useEffect, useState } from 'react';
import { Box, Button, Typography, List, ListItemButton, ListItemText, IconButton, Divider } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletsHelper } from '../../lib/storage';
import type { Wallet } from '../../lib/storage';
import { DEFAULT_CHAIN, fetchBalances, fetchNativeJpyRate } from '../../lib/chains';
import { useAppStore } from '../../store/appStore';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import heroWalletLarge from '../../assets/heroimage_wallet_large.png';
import emptyImage from '../../assets/image_empty2_large.png';

// 0x1234...abcd — short enough to fit on one line next to the wallet name.
function shortenAddress(address: string): string {
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export default function WalletSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const setBackPathFromLesson = useAppStore((s) => s.setBackPathFromLesson);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Each wallet's JPY-denominated total (JPYC + native converted at the current rate, on
  // the default chain) — fetched once per wallet so it can be shown right in this list.
  const [jpyBalances, setJpyBalances] = useState<Record<string, number>>({});

  const getActiveWalletIndex = async (allWallets: Wallet[]): Promise<number> => {
    const activeWallet = await WalletsHelper.getActive();
    if (!activeWallet) {
      return -1;
    }
    return allWallets.findIndex((w) => w.id === activeWallet.id);
  };

  const load = async () => {
    const allWallets = await WalletsHelper.gets();
    setWallets(allWallets);
    setActiveIndex(await getActiveWalletIndex(allWallets));

    const jpyRate = await fetchNativeJpyRate(DEFAULT_CHAIN);
    const entries = await Promise.all(allWallets.map(async (wallet) => {
      try {
        const balances = await fetchBalances(DEFAULT_CHAIN, wallet.address);
        return [wallet.id, Number(balances.jpyc) + Number(balances.native) * jpyRate] as const;
      } catch (e) {
        console.error(`Failed to fetch balance for wallet ${wallet.id}`, e);
        return [wallet.id, 0] as const;
      }
    }));
    setJpyBalances(Object.fromEntries(entries));
  };

  useEffect(() => {
    load();
  }, []);

  const setActiveWallet = async (wallet: Wallet) => {
    await WalletsHelper.setActive(wallet.id);
    setActiveIndex(await getActiveWalletIndex(wallets));
    navigate('/top');
  };

  // 「セキュリティレッスンを受ける」導線は、以前はナビゲーションメニューの Help から
  // 開いていたが、初めてウォレットに触れる人がまず目にするこの画面（For BEGINNERS）に
  // 一本化した。backPathFromLesson に現在地を記録しておくことで、レッスン画面の「←」で
  // ここに戻ってこられる。
  const goToSecurityLesson = () => {
    setBackPathFromLesson(location.pathname + location.search);
    navigate('/lesson/introduction');
  };

  return (
    <div>
      <Box sx={{ display: 'flex', flexDirection: 'column', width: '100vw' }}>
        <AppToolBar title={t('wallet.select')} back="/top" />
        <WalletBar isOpened />
        <Box component="img" src={heroWalletLarge} sx={{ width: '100%' }} />
        <Box sx={{ display: 'flex', gap: 1, m: 2 }}>
          <Button variant="contained" color="primary" sx={{ flex: 1 }} onClick={() => navigate('/wallet/creation/type')}>
            {t('wallet.create_new_wallet')}
          </Button>
          {/* すでに1件でもウォレット（＝リカバリーフレーズ）がある場合、このボタンから
             もう一度レッスンに入るとベータ用のウォレットがもう1つ作られてしまい、
             リカバリーフレーズが2件インポートされた状態になる。初めて触る人向けの
             導線なので、ウォレットが0件のときだけ表示する。 */}
          {wallets.length === 0 && (
            <Button variant="outlined" color="primary" sx={{ flexShrink: 0 }} onClick={goToSecurityLesson}>
              {t('wallet.for_beginners')}
            </Button>
          )}
        </Box>

        {wallets.length === 0 ? (
          <Box sx={{ textAlign: 'center' }}>
            <Box component="img" src={emptyImage} sx={{ width: '50vw', maxWidth: 150 }} />
            <Typography variant="h6" color="text.secondary">{t('wallet.no_wallet_title')}</Typography>
            <Typography color="text.secondary" sx={{ mx: 2 }}>
              {(t('wallet.no_wallet_message', { returnObjects: true }) as string[]).map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </Typography>
          </Box>
        ) : (
          <List>
            {wallets.map((wallet, index) => (
              <Box key={wallet.id}>
                <ListItemButton
                  onClick={() => setActiveWallet(wallet)}
                  selected={index === activeIndex}
                  sx={{ py: 1.5 }}
                >
                  <ListItemText
                    primary={wallet.name}
                    secondary={(
                      <>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary' }}>
                          {shortenAddress(wallet.address)}
                        </Typography>
                        <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary' }}>
                          {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(jpyBalances[wallet.id] ?? 0)}
                        </Typography>
                      </>
                    )}
                  />
                  <IconButton
                    edge="end"
                    onClick={(e) => { e.stopPropagation(); navigate(`/wallet/settings?id=${wallet.id}`); }}
                  >
                    <SettingsIcon color="primary" />
                  </IconButton>
                </ListItemButton>
                <Divider variant="inset" />
              </Box>
            ))}
          </List>
        )}
      </Box>
    </div>
  );
}
