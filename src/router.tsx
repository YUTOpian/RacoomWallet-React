import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import PlaceholderPage from './pages/PlaceholderPage';
import { WalletsHelper } from './lib/storage';

// Every real screen is loaded via React.lazy() so the initial JS bundle only contains the
// app shell (router, theme, i18n bootstrap) — each route's code is fetched on first visit
// instead of all being bundled into one ~1.4MB file up front.
const WalletCreationType = lazy(() => import('./pages/wallet/WalletCreationType'));
const WalletCreationName = lazy(() => import('./pages/wallet/WalletCreationName'));
const WalletCreationMnemonic = lazy(() => import('./pages/wallet/WalletCreationMnemonic'));
const WalletCreationNew = lazy(() => import('./pages/wallet/WalletCreationNew'));
const WalletCreationEnd = lazy(() => import('./pages/wallet/WalletCreationEnd'));
const WalletLoginImport = lazy(() => import('./pages/wallet/WalletLoginImport'));
const WalletLoginName = lazy(() => import('./pages/wallet/WalletLoginName'));
const WalletLoginEnd = lazy(() => import('./pages/wallet/WalletLoginEnd'));
const WalletSelect = lazy(() => import('./pages/wallet/WalletSelect'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Top = lazy(() => import('./pages/top/Top'));
const Balance = lazy(() => import('./pages/detail/Balance'));
const SendAmount = lazy(() => import('./pages/send/SendAmount'));
const SendSymbolAmount = lazy(() => import('./pages/send/SendSymbolAmount'));
const SendNemAmount = lazy(() => import('./pages/send/SendNemAmount'));
const SendConfirmation = lazy(() => import('./pages/send/SendConfirmation'));
const SendComplete = lazy(() => import('./pages/send/SendComplete'));
const TransactionList = lazy(() => import('./pages/transaction/TransactionList'));
const TransactionDetail = lazy(() => import('./pages/transaction/TransactionDetail'));
const SwapTop = lazy(() => import('./pages/swap/SwapTop'));
const SwapConfirmation = lazy(() => import('./pages/swap/SwapConfirmation'));
const SwapComplete = lazy(() => import('./pages/swap/SwapComplete'));
const WalletSettings = lazy(() => import('./pages/wallet/WalletSettings'));
const WalletDetail = lazy(() => import('./pages/wallet/WalletDetail'));
const WalletAddress = lazy(() => import('./pages/wallet/WalletAddress'));
const WalletBackupCaution = lazy(() => import('./pages/wallet/WalletBackupCaution'));
const WalletBackup = lazy(() => import('./pages/wallet/WalletBackup'));
const WalletDelete = lazy(() => import('./pages/wallet/WalletDelete'));
const SettingsTop = lazy(() => import('./pages/settings/SettingsTop'));
const AssetRecoveryList = lazy(() => import('./pages/settings/AssetRecoveryList'));
const AssetRecoveryForm = lazy(() => import('./pages/settings/AssetRecoveryForm'));
const AssetRecoverySend = lazy(() => import('./pages/settings/AssetRecoverySend'));
const DonationTop = lazy(() => import('./pages/donation/DonationTop'));
const DonationDetail = lazy(() => import('./pages/donation/DonationDetail'));
const About = lazy(() => import('./pages/about/About'));
const LessonIntroduction = lazy(() => import('./pages/lesson/LessonIntroduction'));
const LessonLevel = lazy(() => import('./pages/lesson/LessonLevel'));
const LessonBeginner = lazy(() => import('./pages/lesson/LessonBeginner'));
const LessonBeginnerBackupEnd = lazy(() => import('./pages/lesson/LessonBeginnerBackupEnd'));
const LessonBeginnerEnd = lazy(() => import('./pages/lesson/LessonBeginnerEnd'));
const LessonLogin = lazy(() => import('./pages/lesson/LessonLogin'));
const LessonLoginEnd = lazy(() => import('./pages/lesson/LessonLoginEnd'));
const LessonUser = lazy(() => import('./pages/lesson/LessonUser'));
const QRGeneratorAmount = lazy(() => import('./pages/qrlab/QRGeneratorAmount'));
const QRGeneratorCollect = lazy(() => import('./pages/qrlab/QRGeneratorCollect'));
const QRGeneratorPending = lazy(() => import('./pages/qrlab/QRGeneratorPending'));
const QRRegister = lazy(() => import('./pages/qrlab/QRRegister'));
const QRRegisterPending = lazy(() => import('./pages/qrlab/QRRegisterPending'));
const AddressBookList = lazy(() => import('./pages/addressbook/AddressBookList'));
const AddressBookDetail = lazy(() => import('./pages/addressbook/AddressBookDetail'));
const AddressBookWalletForm = lazy(() => import('./pages/addressbook/AddressBookWalletForm'));
const MarketplaceList = lazy(() => import('./pages/marketplace/MarketplaceList'));
const MarketplaceForm = lazy(() => import('./pages/marketplace/MarketplaceForm'));
const MarketplaceDetail = lazy(() => import('./pages/marketplace/MarketplaceDetail'));
const MarketplaceCollect = lazy(() => import('./pages/marketplace/MarketplaceCollect'));
const MarketplaceSalesHistory = lazy(() => import('./pages/marketplace/MarketplaceSalesHistory'));
const SymbolTop = lazy(() => import('./pages/symbol/SymbolTop'));
const SymbolBackup = lazy(() => import('./pages/symbol/SymbolBackup'));
const SymbolHarvest = lazy(() => import('./pages/symbol/SymbolHarvest'));
const SymbolSend = lazy(() => import('./pages/symbol/SymbolSend'));
const SymbolReceive = lazy(() => import('./pages/symbol/SymbolReceive'));
const SymbolTransactionList = lazy(() => import('./pages/symbol/SymbolTransactionList'));
const SymbolTransactionDetail = lazy(() => import('./pages/symbol/SymbolTransactionDetail'));
const NemTop = lazy(() => import('./pages/nem/NemTop'));
const NemHarvest = lazy(() => import('./pages/nem/NemHarvest'));
const NemBackup = lazy(() => import('./pages/nem/NemBackup'));
const NemSend = lazy(() => import('./pages/nem/NemSend'));
const NemReceive = lazy(() => import('./pages/nem/NemReceive'));
const NemTransactionList = lazy(() => import('./pages/nem/NemTransactionList'));
const NemTransactionDetail = lazy(() => import('./pages/nem/NemTransactionDetail'));

function RouteFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress color="primary" />
    </Box>
  );
}

// Wraps a lazily-loaded page in its own Suspense boundary so navigating to one route
// shows a spinner only for that route, not a blank screen for the whole app.
function withSuspense(element: ReactElement): ReactElement {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

// 起動時の振り分け:
// - アクティブなウォレットがあれば /top（ホーム）へ。
// - それ以外（ウォレットが1件も無い/あるが選択中のものが無い）は常に /welcome（ウェルカム画面）へ。
//   ウォレットを持っていても一度もアクティブにしていない状態でいきなり /wallet/select
//   に飛ばすと welcome 画面を経由しないままになってしまうため、/wallet/select への
//   遷移は welcome 画面の GET STARTED ボタン経由（ウォレット登録済みならそのまま
//   一覧が表示される）のみとする。
function RootRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const activeWallet = await WalletsHelper.getActive();
        setTarget(activeWallet ? '/top' : '/welcome');
      } catch (e) {
        // ストレージの読み込みに失敗した場合（初期化がまだ済んでいない、ドライバが
        // 使えない等）でもここで固まらないように、安全側の /welcome にフォールバックする。
        console.error('Failed to determine active wallet', e);
        setTarget('/welcome');
      }
    })();
  }, []);

  if (target === null) {
    return <RouteFallback />;
  }
  return <Navigate to={target} replace />;
}

// Route list ported 1:1 from the Vue app's src/router/index.ts. Every path exists from
// day one; most still point at PlaceholderPage so in-app navigation/back-buttons don't
// 404 while screens are ported one at a time — replace an entry's element with the real
// component as each screen gets built.
const routeDefs: { path: string; name: string; element?: ReactElement }[] = [
  { path: '/welcome', name: 'Welcome', element: <Welcome /> },
  { path: '/top', name: 'Top', element: <Top /> },
  { path: '/balance', name: 'Balance', element: <Balance /> },
  { path: '/transaction/list', name: 'TransactionList', element: <TransactionList /> },
  { path: '/transaction/detail', name: 'TransactionDetail', element: <TransactionDetail /> },
  { path: '/wallet/select', name: 'WalletSelect', element: <WalletSelect /> },
  { path: '/wallet/creation/type', name: 'WalletCreationType', element: <WalletCreationType /> },
  { path: '/wallet/creation/name', name: 'WalletCreationName', element: <WalletCreationName /> },
  { path: '/wallet/creation/mnemonic', name: 'WalletCreationMnemonic', element: <WalletCreationMnemonic /> },
  { path: '/wallet/creation/new', name: 'WalletCreationNew', element: <WalletCreationNew /> },
  { path: '/wallet/creation/end', name: 'WalletCreationEnd', element: <WalletCreationEnd /> },
  { path: '/wallet/login/import', name: 'WalletLoginImport', element: <WalletLoginImport /> },
  { path: '/wallet/login/name', name: 'WalletLoginName', element: <WalletLoginName /> },
  { path: '/wallet/login/end', name: 'WalletLoginEnd', element: <WalletLoginEnd /> },
  { path: '/wallet/settings', name: 'WalletSettings', element: <WalletSettings /> },
  { path: '/wallet/address', name: 'WalletAddress', element: <WalletAddress /> },
  { path: '/wallet/backup_caution', name: 'WalletBackupCaution', element: <WalletBackupCaution /> },
  { path: '/wallet/backup', name: 'WalletBackup', element: <WalletBackup /> },
  { path: '/wallet/delete', name: 'WalletDelete', element: <WalletDelete /> },
  { path: '/wallet/detail', name: 'WalletDetail', element: <WalletDetail /> },
  { path: '/lesson/introduction', name: 'LessonIntroduction', element: <LessonIntroduction /> },
  { path: '/lesson/level', name: 'LessonLevel', element: <LessonLevel /> },
  { path: '/lesson/beginner', name: 'LessonBeginner', element: <LessonBeginner /> },
  { path: '/lesson/beginner_backup_end', name: 'LessonBeginnerBackupEnd', element: <LessonBeginnerBackupEnd /> },
  { path: '/lesson/beginner_end', name: 'LessonBeginnerEnd', element: <LessonBeginnerEnd /> },
  { path: '/lesson/key/caution', name: 'LessonKeyCaution', element: <WalletBackupCaution /> },
  { path: '/lesson/key', name: 'LessonKey', element: <WalletBackup /> },
  { path: '/lesson/login', name: 'LessonLogin', element: <LessonLogin /> },
  { path: '/lesson/login_end', name: 'LessonLoginEnd', element: <LessonLoginEnd /> },
  { path: '/lesson/user', name: 'LessonUser', element: <LessonUser /> },
  { path: '/qrlab/amount', name: 'QRGeneratorAmount', element: <QRGeneratorAmount /> },
  { path: '/qrlab/collect', name: 'QRGeneratorCollect', element: <QRGeneratorCollect /> },
  { path: '/qrlab/pending', name: 'QRGeneratorPending', element: <QRGeneratorPending /> },
  { path: '/qrlab/register', name: 'QRRegister', element: <QRRegister /> },
  { path: '/qrlab/register/pending', name: 'QRRegisterPending', element: <QRRegisterPending /> },
  { path: '/send/amount', name: 'SendAmount', element: <SendAmount /> },
  { path: '/send/symbol-amount', name: 'SendSymbolAmount', element: <SendSymbolAmount /> },
  { path: '/send/nem-amount', name: 'SendNemAmount', element: <SendNemAmount /> },
  { path: '/send/confirmation', name: 'SendConfirmation', element: <SendConfirmation /> },
  { path: '/send/complete', name: 'SendComplete', element: <SendComplete /> },
  { path: '/about', name: 'About', element: <About /> },
  { path: '/swap', name: 'SwapTop', element: <SwapTop /> },
  { path: '/swap/confirmation', name: 'SwapConfirmation', element: <SwapConfirmation /> },
  { path: '/swap/complete', name: 'SwapComplete', element: <SwapComplete /> },
  { path: '/donation/top', name: 'DonationTop', element: <DonationTop /> },
  { path: '/donation/detail', name: 'DonationDetail', element: <DonationDetail /> },
  { path: '/settings/top', name: 'SettingsTop', element: <SettingsTop /> },
  { path: '/settings/asset_recovery', name: 'AssetRecoveryList', element: <AssetRecoveryList /> },
  { path: '/settings/asset_recovery/add', name: 'AssetRecoveryForm', element: <AssetRecoveryForm /> },
  { path: '/settings/asset_recovery/send', name: 'AssetRecoverySend', element: <AssetRecoverySend /> },
  { path: '/addressbook', name: 'AddressBookList', element: <AddressBookList /> },
  { path: '/addressbook/detail', name: 'AddressBookDetail', element: <AddressBookDetail /> },
  { path: '/addressbook/wallet', name: 'AddressBookWalletForm', element: <AddressBookWalletForm /> },
  { path: '/marketplace', name: 'MarketplaceList', element: <MarketplaceList /> },
  { path: '/marketplace/form', name: 'MarketplaceForm', element: <MarketplaceForm /> },
  { path: '/marketplace/detail', name: 'MarketplaceDetail', element: <MarketplaceDetail /> },
  { path: '/marketplace/collect', name: 'MarketplaceCollect', element: <MarketplaceCollect /> },
  { path: '/marketplace/history', name: 'MarketplaceSalesHistory', element: <MarketplaceSalesHistory /> },
  { path: '/symbol', name: 'SymbolTop', element: <SymbolTop /> },
  { path: '/symbol/backup', name: 'SymbolBackup', element: <SymbolBackup /> },
  { path: '/symbol/harvest', name: 'SymbolHarvest', element: <SymbolHarvest /> },
  { path: '/symbol/send', name: 'SymbolSend', element: <SymbolSend /> },
  { path: '/symbol/receive', name: 'SymbolReceive', element: <SymbolReceive /> },
  { path: '/symbol/transaction/list', name: 'SymbolTransactionList', element: <SymbolTransactionList /> },
  { path: '/symbol/transaction/detail', name: 'SymbolTransactionDetail', element: <SymbolTransactionDetail /> },
  { path: '/nem', name: 'NemTop', element: <NemTop /> },
  { path: '/nem/harvest', name: 'NemHarvest', element: <NemHarvest /> },
  { path: '/nem/backup', name: 'NemBackup', element: <NemBackup /> },
  { path: '/nem/send', name: 'NemSend', element: <NemSend /> },
  { path: '/nem/receive', name: 'NemReceive', element: <NemReceive /> },
  { path: '/nem/transaction/list', name: 'NemTransactionList', element: <NemTransactionList /> },
  { path: '/nem/transaction/detail', name: 'NemTransactionDetail', element: <NemTransactionDetail /> },
];

// HashRouter (not BrowserRouter) so this works both when opened directly as a local
// file (file://index.html) and when hosted on GitHub Pages: routing state lives entirely
// in the URL fragment (#/top, #/wallet/select, ...), so no server-side rewrite rules are
// needed for a route to be requested directly or refreshed — the server (or filesystem)
// only ever sees a request for index.html itself.
export const router = createHashRouter([
  { path: '/', element: <RootRedirect /> },
  ...routeDefs.map(({ path, name, element }) => ({
    path,
    element: withSuspense(element ?? <PlaceholderPage name={name} />),
  })),
]);
