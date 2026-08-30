import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, List, ListItemButton, ListItemText, Radio,
  TextField, Divider,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EnergySavingsLeafOutlinedIcon from '@mui/icons-material/EnergySavingsLeafOutlined';
import AppToolBar from '../../components/AppToolBar';
import WalletBar from '../../components/WalletBar';
import PinDialog from '../../components/PinDialog';
import ErrorSnackbar from '../../components/ErrorSnackbar';
import NemBottomNav, { NEM_BOTTOM_NAV_HEIGHT } from '../../components/NemBottomNav';
import NemHarvestHero from '../../components/NemHarvestHero';
import NemNodeSelectHero from '../../components/NemNodeSelectHero';
import { WalletsHelper } from '../../lib/storage';
import { NemAccountHelper } from '../../lib/nemAccount';
import {
  fetchHarvestingNodeOptions, fetchHarvestingNodeOptionByUrl, fetchHarvestingStatus,
  generateHarvestingKeyPair, estimateHarvestLinkFee, signAndAnnounceHarvestLink,
  waitForHarvestLinkConfirmation, submitNodeUnlockRequest,
  saveHarvestingLinkInfo, loadHarvestingLinkInfo, clearHarvestingLinkInfo,
} from '../../lib/nemHarvest';
import type { HarvestingNodeOption, HarvestingStatus, HarvestingKeyPair, HarvestingLinkInfo } from '../../lib/nemHarvest';

// Sampled from the NEM tri-color mark, same as NemTop.tsx's balance card and the rest of
// the NEM screen family (NemHero/NemBackupHero/NemReceiveHero) - the middle blue reads
// well as a solid accent color for buttons/text, the same role Symbol's screens give their
// single violet (#8239DD).
const NEM_BLUE = '#2A85DF';

type ScreenState = 'loading' | 'no_wallet' | 'locked' | 'ready';
type Step =
  | 'status'
  | 'select_node'
  | 'confirm_link'
  | 'processing_link'
  | 'complete_link'
  | 'confirm_unlink'
  | 'processing_unlink'
  | 'complete_unlink';

// NEM delegated ("remote") harvesting activation/停止. Reachable from NemTop/NemBackup's
// bottom nav (previously just a "coming soon" dialog - see NemBottomNav.tsx). Needs its own
// PIN-gated unlock like NemTop/NemBackup because both activating and stopping harvesting
// sign a real on-chain transaction with the wallet's NEM private key. See lib/nemHarvest.ts
// for how this differs from Symbol's version (single key link, no VRF/node key, and no
// on-chain record of which node a remote key is delegated to).
export default function NemHarvest() {
  const [state, setState] = useState<ScreenState>('loading');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [status, setStatus] = useState<HarvestingStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [linkInfo, setLinkInfo] = useState<HarvestingLinkInfo | null>(null);

  const [step, setStep] = useState<Step>('status');
  const [nodeOptions, setNodeOptions] = useState<HarvestingNodeOption[] | 'loading'>('loading');
  const [selectedNode, setSelectedNode] = useState<HarvestingNodeOption | null>(null);
  const [manualNodeUrl, setManualNodeUrl] = useState('');
  const [manualNodeLoading, setManualNodeLoading] = useState(false);
  const [pendingKeyPair, setPendingKeyPair] = useState<HarvestingKeyPair | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null | 'loading'>('loading');
  const [processingMessage, setProcessingMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  const loadStatus = useCallback(async (addr: string, id: string) => {
    setStatusLoading(true);
    try {
      const s = await fetchHarvestingStatus(addr);
      setStatus(s);
      setLinkInfo(loadHarvestingLinkInfo(id));
    } catch (e) {
      console.error('Failed to fetch NEM harvesting status', e);
      setErrorMessage("Couldn't fetch the harvesting status");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setState('loading');
    const activeWallet = await WalletsHelper.getActive();
    if (!activeWallet) {
      setState('no_wallet');
      return;
    }
    setWalletId(activeWallet.id);

    if (activeWallet.nemAddress) {
      setAddress(activeWallet.nemAddress);
      setState('ready');
      await loadStatus(activeWallet.nemAddress, activeWallet.id);
      return;
    }
    setState('locked');
  }, [loadStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const onUnlockPassed = async (pin: string) => {
    if (!walletId) return;
    try {
      const privateKey = await WalletsHelper.decryptKey(walletId, pin);
      if (!privateKey) {
        setErrorMessage('Incorrect PIN');
        return;
      }
      const account = NemAccountHelper.fromPrivateKey(privateKey);
      await WalletsHelper.cacheNemAccount(walletId, account.address, account.publicKey);
      setAddress(account.address);
      setState('ready');
      setShowPinDialog(false);
      await loadStatus(account.address, walletId);
    } catch (e) {
      console.error('Failed to derive NEM account', e);
      setErrorMessage('Failed to generate the NEM address');
    }
  };

  // --- Start harvesting -----------------------------------------------------------------

  const onStartSetup = async () => {
    setStep('select_node');
    setSelectedNode(null);
    setManualNodeUrl('');
    setNodeOptions('loading');
    try {
      const options = await fetchHarvestingNodeOptions();
      setNodeOptions(options);
    } catch (e) {
      console.error('Failed to fetch harvesting node candidates', e);
      setNodeOptions([]);
    }
  };

  // URL入力で直接ノードを指定するパス。一覧(fetchHarvestingNodeOptions)は既知のノード一覧
  // しか見に行かないため、そこに載っていないノードを使いたい場合の入り口。
  const onSubmitManualNode = async () => {
    setManualNodeLoading(true);
    try {
      const option = await fetchHarvestingNodeOptionByUrl(manualNodeUrl);
      await onSelectNode(option);
    } catch (e) {
      console.error('Failed to resolve manually entered harvesting node', e);
      setErrorMessage(e instanceof Error ? e.message : "Couldn't fetch nodes");
    } finally {
      setManualNodeLoading(false);
    }
  };

  const onSelectNode = async (node: HarvestingNodeOption) => {
    // Wrapped in try/catch so a failure here surfaces a visible error instead of silently
    // leaving the screen on the node list (see the identical comment in
    // pages/symbol/SymbolHarvest.tsx's onSelectNode for the full reasoning).
    try {
      const keyPair = generateHarvestingKeyPair();
      setSelectedNode(node);
      setPendingKeyPair(keyPair);
      setStep('confirm_link');
      setEstimatedFee('loading');
      setEstimatedFee(await estimateHarvestLinkFee());
    } catch (e) {
      console.error('Failed to select harvesting node', e);
      setErrorMessage('Failed to select the node');
    }
  };

  const onConfirmLinkPassed = async (pin: string) => {
    if (!walletId || !address || !selectedNode || !pendingKeyPair) return;
    setShowPinDialog(false);
    setStep('processing_link');
    try {
      const privateKey = await WalletsHelper.decryptKey(walletId, pin);
      if (!privateKey) {
        setErrorMessage('Incorrect PIN');
        setStep('confirm_link');
        return;
      }

      const remotePublicKeyHex = pendingKeyPair.remoteKeyPair.publicKey.toString();

      setProcessingMessage('Sending the account key-link transaction...');
      const { hash } = await signAndAnnounceHarvestLink(privateKey, remotePublicKeyHex, 'link');
      setTxHash(hash);

      setProcessingMessage('Waiting for block confirmation...');
      const result = await waitForHarvestLinkConfirmation(address, 'link');
      if (result === 'timeout') {
        throw new Error('Confirmation timed out. Please check the network status and try again in a moment.');
      }

      setProcessingMessage('Registering harvest delegation with the node...');
      const remotePrivateKeyHex = pendingKeyPair.remoteKeyPair.privateKey.toString();
      await submitNodeUnlockRequest(selectedNode.url, remotePrivateKeyHex);

      saveHarvestingLinkInfo(walletId, { remotePublicKey: remotePublicKeyHex, nodeUrl: selectedNode.url });
      setStep('complete_link');
    } catch (e) {
      console.error('Failed to activate NEM harvesting', e);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to set up harvesting');
      setStep('confirm_link');
    }
  };

  // --- Stop harvesting -------------------------------------------------------------------

  const onStartStop = () => {
    setStep('confirm_unlink');
    setEstimatedFee('loading');
    estimateHarvestLinkFee().then(setEstimatedFee);
  };

  const onConfirmUnlinkPassed = async (pin: string) => {
    if (!walletId || !address || !linkInfo) return;
    setShowPinDialog(false);
    setStep('processing_unlink');
    try {
      const privateKey = await WalletsHelper.decryptKey(walletId, pin);
      if (!privateKey) {
        setErrorMessage('Incorrect PIN');
        setStep('confirm_unlink');
        return;
      }

      setProcessingMessage('Sending the key-unlink transaction...');
      const { hash } = await signAndAnnounceHarvestLink(privateKey, linkInfo.remotePublicKey, 'unlink');
      setTxHash(hash);

      setProcessingMessage('Waiting for block confirmation...');
      const result = await waitForHarvestLinkConfirmation(address, 'unlink');
      if (result === 'timeout') {
        throw new Error('Confirmation timed out. Please check the network status and try again in a moment.');
      }

      // Revoking the node-side unlock requires the remote account's *private* key, which
      // (by design - see lib/nemHarvest.ts) was never persisted past the activation
      // session, so there's nothing left to notify here. That's non-fatal: the on-chain
      // unlink above already makes any further blocks the node produces with that key stop
      // counting as this account's harvesting.
      clearHarvestingLinkInfo(walletId);
      setStep('complete_unlink');
    } catch (e) {
      console.error('Failed to stop NEM harvesting', e);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to stop harvesting');
      setStep('confirm_unlink');
    }
  };

  const onFinish = async () => {
    setStep('status');
    setPendingKeyPair(null);
    setSelectedNode(null);
    if (address && walletId) await loadStatus(address, walletId);
  };

  // --- Rendering ---------------------------------------------------------------------------

  if (state === 'loading') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/nem" title="Harvest settings" />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (state === 'no_wallet') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/nem" title="Harvest settings" />
        <Box sx={{ px: 2, mt: 8, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            ウォレットが見つからないため、ハーベスト機能は利用できません。
          </Typography>
        </Box>
      </Box>
    );
  }

  if (state === 'locked') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/nem" title="Harvest settings" />
        <Box sx={{ px: 2, mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <LockOutlinedIcon sx={{ fontSize: 40, color: '#929292' }} />
          <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
            ハーベスト設定を行うには、PINの入力が必要です。
          </Typography>
          <Button variant="contained" disableElevation onClick={() => setShowPinDialog(true)}>
            PINを入力してハーベスト設定を開く
          </Button>
        </Box>
        <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onUnlockPassed} />
        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      </Box>
    );
  }

  // step: select_node
  if (step === 'select_node') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/nem/harvest" title="Select a node" onBack={() => setStep('status')} />
        <NemNodeSelectHero />
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>
            ハーベスト委任先の秘密鍵を渡すノードを選択してください。
          </Typography>
          {nodeOptions === 'loading' ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : nodeOptions.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', mt: 4, textAlign: 'center' }}>
              利用可能なノードが見つかりませんでした。しばらくしてから再度お試しください。
            </Typography>
          ) : (
            <List>
              {nodeOptions.map((node) => (
                <ListItemButton
                  key={node.url}
                  onClick={() => onSelectNode(node)}
                  sx={{ borderRadius: 2, mb: 1, border: '0.5px solid', borderColor: 'divider' }}
                >
                  <Radio checked={false} sx={{ color: NEM_BLUE, '&.Mui-checked': { color: NEM_BLUE } }} />
                  <ListItemText
                    primary={node.friendlyName}
                    secondary={node.host}
                    slotProps={{ secondary: { sx: { wordBreak: 'break-all', fontSize: 12 } } }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}

          <Divider sx={{ my: 2 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>or</Typography>
          </Divider>

          <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>
            上の一覧にないノードは、NIS APIのURLを直接入力して選択できます。
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="https://example.com:7891"
            value={manualNodeUrl}
            onChange={(e) => setManualNodeUrl(e.target.value)}
            disabled={manualNodeLoading}
          />
          <Button
            fullWidth
            variant="outlined"
            disableElevation
            sx={{ mt: 1, mb: 2, color: NEM_BLUE, borderColor: NEM_BLUE, '&:hover': { borderColor: NEM_BLUE } }}
            disabled={manualNodeUrl.trim().length === 0 || manualNodeLoading}
            onClick={onSubmitManualNode}
          >
            {manualNodeLoading ? <CircularProgress size={20} sx={{ color: NEM_BLUE }} /> : 'Use the node at this URL'}
          </Button>
        </Box>
        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      </Box>
    );
  }

  // step: confirm_link
  if (step === 'confirm_link') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/nem/harvest" title="Confirm harvest settings" onBack={() => setStep('select_node')} />
        <NemHarvestHero />
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: NEM_BLUE }}>Delegated node</Typography>
          <Typography sx={{ wordBreak: 'break-all' }}>{selectedNode?.friendlyName}</Typography>

          <Typography sx={{ color: NEM_BLUE, mt: 2 }}>Fee (estimated)</Typography>
          <Typography>
            {estimatedFee === 'loading' ? 'Calculating...' : estimatedFee != null ? `About ${estimatedFee} XEM` : "Couldn't fetch the fee"}
          </Typography>

          <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 2 }}>
            アカウントキーリンクトランザクション(委任ハーベスティング設定)を送信し、承認後に選択したノードへハーベスト用の鍵を渡します(ウォレット本体の秘密鍵は共有されません)。
            多くの公開ノードは見知らぬ相手からの委任登録を受け付けていないため、ノードによっては登録に失敗することがあります。
          </Typography>

          <Button
            fullWidth
            variant="contained"
            disableElevation
            size="large"
            sx={{ mt: 3, bgcolor: NEM_BLUE, '&:hover': { bgcolor: NEM_BLUE } }}
            onClick={() => setShowPinDialog(true)}
          >
            PINを入力して設定する
          </Button>
        </Box>
        <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onConfirmLinkPassed} />
        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      </Box>
    );
  }

  // step: confirm_unlink
  if (step === 'confirm_unlink') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/nem/harvest" title="Confirm stopping harvest" onBack={() => setStep('status')} />
        <NemHarvestHero />
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: 'text.secondary' }}>
            現在有効なハーベスト設定を解除します。
          </Typography>

          <Typography sx={{ color: NEM_BLUE, mt: 2 }}>Fee (estimated)</Typography>
          <Typography>
            {estimatedFee === 'loading' ? 'Calculating...' : estimatedFee != null ? `About ${estimatedFee} XEM` : "Couldn't fetch the fee"}
          </Typography>

          <Button
            fullWidth
            variant="contained"
            disableElevation
            size="large"
            color="error"
            sx={{ mt: 3 }}
            onClick={() => setShowPinDialog(true)}
          >
            PINを入力して停止する
          </Button>
        </Box>
        <PinDialog open={showPinDialog} mode="check" onClose={() => setShowPinDialog(false)} onPass={onConfirmUnlinkPassed} />
        <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
      </Box>
    );
  }

  // step: processing_link / processing_unlink
  if (step === 'processing_link' || step === 'processing_unlink') {
    return (
      <Box sx={{ width: '100vw', height: '100vh' }}>
        <AppToolBar back="/nem" title={step === 'processing_link' ? 'Setting up harvest' : 'Stopping harvest'} showBack={false} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, px: 3, gap: 2 }}>
          <CircularProgress sx={{ color: NEM_BLUE }} />
          <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>{processingMessage}</Typography>
          {txHash && (
            <Typography sx={{ color: 'text.secondary', fontSize: 12, wordBreak: 'break-all', textAlign: 'center' }}>
              トランザクションハッシュ: {txHash}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // step: complete_link / complete_unlink
  if (step === 'complete_link' || step === 'complete_unlink') {
    return (
      <Box sx={{ width: '100vw', height: '100vh' }}>
        <AppToolBar back="/nem" title={step === 'complete_link' ? 'Setup complete' : 'Stopped'} showBack={false} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, px: 3, gap: 2 }}>
          <EnergySavingsLeafOutlinedIcon sx={{ fontSize: 40, color: NEM_BLUE }} />
          <Typography sx={{ fontSize: 18, fontWeight: 'bold' }}>
            {step === 'complete_link' ? 'Harvesting has been set up' : 'Harvesting has been stopped'}
          </Typography>
          {step === 'complete_link' && (
            <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center' }}>
              ノードでの反映まで数分かかる場合があります。
            </Typography>
          )}
          <Button variant="contained" disableElevation sx={{ bgcolor: NEM_BLUE, '&:hover': { bgcolor: NEM_BLUE } }} onClick={onFinish}>
            ハーベスト設定に戻る
          </Button>
        </Box>
      </Box>
    );
  }

  // step: status (default)
  const isActive = status?.remoteStatus === 'ACTIVE';
  const isPending = status?.remoteStatus === 'ACTIVATING' || status?.remoteStatus === 'DEACTIVATING';
  const canStop = isActive && !!linkInfo;

  return (
    <Box sx={{ width: '100vw', pb: `${NEM_BOTTOM_NAV_HEIGHT}px` }}>
      <AppToolBar back="/nem" title="Harvest settings" />
      <WalletBar isOpened={false} />
      <NemHarvestHero />

      <Box sx={{ px: 2, mt: 2 }}>
        {statusLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : isActive ? (
          <>
            <Typography sx={{ color: NEM_BLUE, fontWeight: 'bold' }}>Harvesting: Active</Typography>

            <Typography sx={{ color: NEM_BLUE, mt: 2 }}>Importance</Typography>
            <Typography>{status?.importance ?? 0}</Typography>

            <Typography sx={{ color: NEM_BLUE, mt: 2 }}>Blocks harvested</Typography>
            <Typography>{status?.harvestedBlocks ?? 0}</Typography>

            {!linkInfo && (
              <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 2 }}>
                このデバイスでは委任先ノードの情報が確認できないため、ここから停止することはできません
                (別のデバイスで設定した場合など)。停止するには、設定時に使用したデバイスをご利用ください。
              </Typography>
            )}

            <Button
              fullWidth
              variant="outlined"
              color="error"
              size="large"
              sx={{ mt: 3 }}
              disabled={!canStop}
              onClick={onStartStop}
            >
              ハーベストを停止する
            </Button>
          </>
        ) : isPending ? (
          <>
            <Typography sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
              ハーベスト: {status?.remoteStatus === 'ACTIVATING' ? 'Setting up' : 'Stopping'}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 1 }}>
              トランザクションがブロックに取り込まれるまで、しばらくお待ちください。
            </Typography>
            <Button fullWidth variant="outlined" size="large" sx={{ mt: 3 }} onClick={() => address && walletId && loadStatus(address, walletId)}>
              状態を更新
            </Button>
          </>
        ) : (
          <>
            <Typography sx={{ color: 'text.secondary', fontWeight: 'bold' }}>Harvesting: Inactive</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 1 }}>
              委任ハーベストを設定すると、選択したノードにブロック生成を委任し、報酬の一部を受け取れる場合があります。
            </Typography>
            <Button
              fullWidth
              variant="contained"
              disableElevation
              size="large"
              sx={{ mt: 3, bgcolor: NEM_BLUE, '&:hover': { bgcolor: NEM_BLUE } }}
              onClick={onStartSetup}
            >
              ハーベストを設定する
            </Button>
          </>
        )}
      </Box>

      <NemBottomNav active="harvest" onHarvestClick={() => {}} hideOther />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
