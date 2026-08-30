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
import SymbolBottomNav, { SYMBOL_BOTTOM_NAV_HEIGHT } from '../../components/SymbolBottomNav';
import SymbolHarvestHero from '../../components/SymbolHarvestHero';
import SymbolNodeSelectHero from '../../components/SymbolNodeSelectHero';
import { WalletsHelper } from '../../lib/storage';
import { SymbolAccountHelper } from '../../lib/symbolAccount';
import {
  fetchHarvestingNodeOptions, fetchHarvestingNodeOptionByUrl, fetchHarvestingStatus, findNodeOptionByPublicKey,
  generateHarvestingKeyPairs, estimateHarvestLinkFee, signAndAnnounceHarvestLink,
  waitForHarvestLinkConfirmation, submitNodeUnlockRequest, revokeNodeUnlockRequest,
  saveHarvestingNodeUrl, loadHarvestingNodeUrl, clearHarvestingNodeUrl,
} from '../../lib/symbolHarvest';
import type { HarvestingNodeOption, HarvestingStatus, HarvestingKeyPairs } from '../../lib/symbolHarvest';

const SYMBOL_VIOLET = '#8239DD';

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

// Symbol delegated-harvesting activation/停止. Reachable from SymbolTop/SymbolBackup's
// bottom nav (previously just a "coming soon" dialog - see SymbolBottomNav.tsx). Needs its
// own PIN-gated unlock like SymbolTop/SymbolBackup because both activating and stopping
// harvesting sign a real on-chain transaction with the wallet's Symbol private key.
export default function SymbolHarvest() {
  const [state, setState] = useState<ScreenState>('loading');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [status, setStatus] = useState<HarvestingStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [step, setStep] = useState<Step>('status');
  const [nodeOptions, setNodeOptions] = useState<HarvestingNodeOption[] | 'loading'>('loading');
  const [selectedNode, setSelectedNode] = useState<HarvestingNodeOption | null>(null);
  const [manualNodeUrl, setManualNodeUrl] = useState('');
  const [manualNodeLoading, setManualNodeLoading] = useState(false);
  const [pendingKeyPairs, setPendingKeyPairs] = useState<HarvestingKeyPairs | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null | 'loading'>('loading');
  const [processingMessage, setProcessingMessage] = useState('');
  const [txHash, setTxHash] = useState('');

  const loadStatus = useCallback(async (addr: string) => {
    setStatusLoading(true);
    try {
      const s = await fetchHarvestingStatus(addr);
      setStatus(s);
    } catch (e) {
      console.error('Failed to fetch Symbol harvesting status', e);
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

    if (activeWallet.symbolAddress && activeWallet.symbolPublicKey) {
      setAddress(activeWallet.symbolAddress);
      setPublicKey(activeWallet.symbolPublicKey);
      setState('ready');
      await loadStatus(activeWallet.symbolAddress);
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
      const account = SymbolAccountHelper.fromPrivateKey(privateKey);
      await WalletsHelper.cacheSymbolAccount(walletId, account.address, account.publicKey);
      setAddress(account.address);
      setPublicKey(account.publicKey);
      setState('ready');
      setShowPinDialog(false);
      await loadStatus(account.address);
    } catch (e) {
      console.error('Failed to derive Symbol account', e);
      setErrorMessage('Failed to generate the Symbol address');
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
    if (!publicKey) return;
    // generateHarvestingKeyPairs() runs before any state update below. Previously, if it
    // (or anything else in this first part of the function) threw, the whole async function
    // simply rejected with nothing catching it - the screen silently stayed on the node list
    // with no visible error, looking like tapping a node "did nothing". Wrapping the whole
    // function guarantees a visible error instead of a silent no-op.
    try {
      const keyPairs = generateHarvestingKeyPairs();
      setSelectedNode(node);
      setPendingKeyPairs(keyPairs);
      setStep('confirm_link');
      setEstimatedFee('loading');
      try {
        const fee = await estimateHarvestLinkFee(
          publicKey,
          keyPairs.remoteKeyPair.publicKey.toString(),
          keyPairs.vrfKeyPair.publicKey.toString(),
          node.publicKey,
          'link',
        );
        setEstimatedFee(fee);
      } catch (e) {
        console.error('Failed to estimate harvesting link fee', e);
        setEstimatedFee(null);
      }
    } catch (e) {
      console.error('Failed to select harvesting node', e);
      setErrorMessage('Failed to select the node');
    }
  };

  const onConfirmLinkPassed = async (pin: string) => {
    if (!walletId || !selectedNode || !pendingKeyPairs) return;
    setShowPinDialog(false);
    setStep('processing_link');
    try {
      const privateKey = await WalletsHelper.decryptKey(walletId, pin);
      if (!privateKey) {
        setErrorMessage('Incorrect PIN');
        setStep('confirm_link');
        return;
      }

      setProcessingMessage('Sending the key-link transaction...');
      const { hash } = await signAndAnnounceHarvestLink(
        privateKey,
        pendingKeyPairs.remoteKeyPair.publicKey.toString(),
        pendingKeyPairs.vrfKeyPair.publicKey.toString(),
        selectedNode.publicKey,
        'link',
      );
      setTxHash(hash);

      setProcessingMessage('Waiting for block confirmation...');
      const result = await waitForHarvestLinkConfirmation(hash);
      if (result === 'failed') {
        throw new Error('The key-link transaction failed');
      }
      if (result === 'timeout') {
        throw new Error('Confirmation timed out. Please check the network status and try again in a moment.');
      }

      setProcessingMessage('Registering harvest delegation with the node...');
      await submitNodeUnlockRequest(selectedNode.url, selectedNode.publicKey, pendingKeyPairs);

      saveHarvestingNodeUrl(walletId, selectedNode.url);
      setStep('complete_link');
    } catch (e) {
      console.error('Failed to activate Symbol harvesting', e);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to set up harvesting');
      setStep('confirm_link');
    }
  };

  // --- Stop harvesting -------------------------------------------------------------------

  const onStartStop = () => {
    setStep('confirm_unlink');
    setEstimatedFee('loading');
    (async () => {
      if (!publicKey || !status?.linkedPublicKey || !status?.vrfPublicKey || !status?.nodePublicKey) return;
      try {
        const fee = await estimateHarvestLinkFee(
          publicKey,
          status.linkedPublicKey,
          status.vrfPublicKey,
          status.nodePublicKey,
          'unlink',
        );
        setEstimatedFee(fee);
      } catch (e) {
        console.error('Failed to estimate harvesting unlink fee', e);
        setEstimatedFee(null);
      }
    })();
  };

  const onConfirmUnlinkPassed = async (pin: string) => {
    if (!walletId || !status?.linkedPublicKey || !status?.vrfPublicKey || !status?.nodePublicKey) return;
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
      const { hash } = await signAndAnnounceHarvestLink(
        privateKey,
        status.linkedPublicKey,
        status.vrfPublicKey,
        status.nodePublicKey,
        'unlink',
      );
      setTxHash(hash);

      setProcessingMessage('Waiting for block confirmation...');
      const result = await waitForHarvestLinkConfirmation(hash);
      if (result === 'failed') {
        throw new Error('The key-unlink transaction failed');
      }
      if (result === 'timeout') {
        throw new Error('Confirmation timed out. Please check the network status and try again in a moment.');
      }

      setProcessingMessage('Notifying the node to stop harvesting...');
      let nodeUrl = walletId ? loadHarvestingNodeUrl(walletId) : null;
      if (!nodeUrl) {
        const node = await findNodeOptionByPublicKey(status.nodePublicKey);
        nodeUrl = node?.url ?? null;
      }
      if (nodeUrl) {
        try {
          await revokeNodeUnlockRequest(nodeUrl, status.linkedPublicKey);
        } catch (e) {
          // The on-chain unlink already went through, which is what actually matters -
          // the node-side unlock naturally stops mattering once it can no longer verify
          // the (now unlinked) account, so this step failing isn't fatal to the outcome.
          console.warn('Failed to notify node of harvesting stop (non-fatal)', e);
        }
      }
      if (walletId) clearHarvestingNodeUrl(walletId);

      setStep('complete_unlink');
    } catch (e) {
      console.error('Failed to stop Symbol harvesting', e);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to stop harvesting');
      setStep('confirm_unlink');
    }
  };

  const onFinish = async () => {
    setStep('status');
    setPendingKeyPairs(null);
    setSelectedNode(null);
    if (address) await loadStatus(address);
  };

  // --- Rendering ---------------------------------------------------------------------------

  if (state === 'loading') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/symbol" title="Harvest settings" backColor={SYMBOL_VIOLET} />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (state === 'no_wallet') {
    return (
      <Box sx={{ width: '100vw' }}>
        <AppToolBar back="/symbol" title="Harvest settings" backColor={SYMBOL_VIOLET} />
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
        <AppToolBar back="/symbol" title="Harvest settings" backColor={SYMBOL_VIOLET} />
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
        <AppToolBar back="/symbol/harvest" title="Select a node" onBack={() => setStep('status')} backColor={SYMBOL_VIOLET} />
        <SymbolNodeSelectHero />
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 1 }}>
            ハーベストを委任するノードを選択してください。
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
                  key={node.publicKey}
                  onClick={() => onSelectNode(node)}
                  sx={{ borderRadius: 2, mb: 1, border: '0.5px solid', borderColor: 'divider' }}
                >
                  <Radio checked={false} sx={{ color: SYMBOL_VIOLET, '&.Mui-checked': { color: SYMBOL_VIOLET } }} />
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
            上の一覧にないノードは、REST APIのURLを直接入力して選択できます。
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="https://example.com:3001"
            value={manualNodeUrl}
            onChange={(e) => setManualNodeUrl(e.target.value)}
            disabled={manualNodeLoading}
          />
          <Button
            fullWidth
            variant="outlined"
            disableElevation
            sx={{ mt: 1, mb: 2, color: SYMBOL_VIOLET, borderColor: SYMBOL_VIOLET, '&:hover': { borderColor: SYMBOL_VIOLET } }}
            disabled={manualNodeUrl.trim().length === 0 || manualNodeLoading}
            onClick={onSubmitManualNode}
          >
            {manualNodeLoading ? <CircularProgress size={20} sx={{ color: SYMBOL_VIOLET }} /> : 'Use the node at this URL'}
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
        <AppToolBar back="/symbol/harvest" title="Confirm harvest settings" onBack={() => setStep('select_node')} backColor={SYMBOL_VIOLET} />
        <SymbolHarvestHero />
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: SYMBOL_VIOLET }}>Delegated node</Typography>
          <Typography sx={{ wordBreak: 'break-all' }}>{selectedNode?.friendlyName}</Typography>

          <Typography sx={{ color: SYMBOL_VIOLET, mt: 2 }}>Fee (estimated)</Typography>
          <Typography>
            {estimatedFee === 'loading' ? 'Calculating...' : estimatedFee != null ? `About ${estimatedFee} XYM` : "Couldn't fetch the fee"}
          </Typography>

          <Typography sx={{ color: 'text.secondary', fontSize: 13, mt: 2 }}>
            アカウントキーリンク・VRFキーリンク・ノードキーリンクの3つのトランザクションを、1つのアグリゲートトランザクションとして送信します。
            承認後、選択したノードにハーベスト用の鍵を委任します(ウォレット本体の秘密鍵は共有されません)。
          </Typography>

          <Button
            fullWidth
            variant="contained"
            disableElevation
            size="large"
            sx={{ mt: 3, bgcolor: SYMBOL_VIOLET, '&:hover': { bgcolor: SYMBOL_VIOLET } }}
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
        <AppToolBar back="/symbol/harvest" title="Confirm stopping harvest" onBack={() => setStep('status')} backColor={SYMBOL_VIOLET} />
        <SymbolHarvestHero />
        <Box sx={{ px: 2, mt: 2 }}>
          <Typography sx={{ color: 'text.secondary' }}>
            現在有効なハーベスト設定を解除します。
          </Typography>

          <Typography sx={{ color: SYMBOL_VIOLET, mt: 2 }}>Fee (estimated)</Typography>
          <Typography>
            {estimatedFee === 'loading' ? 'Calculating...' : estimatedFee != null ? `About ${estimatedFee} XYM` : "Couldn't fetch the fee"}
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
        <AppToolBar back="/symbol" title={step === 'processing_link' ? 'Setting up harvest' : 'Stopping harvest'} showBack={false} backColor={SYMBOL_VIOLET} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, px: 3, gap: 2 }}>
          <CircularProgress sx={{ color: SYMBOL_VIOLET }} />
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
        <AppToolBar back="/symbol" title={step === 'complete_link' ? 'Setup complete' : 'Stopped'} showBack={false} backColor={SYMBOL_VIOLET} />
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, px: 3, gap: 2 }}>
          <EnergySavingsLeafOutlinedIcon sx={{ fontSize: 40, color: SYMBOL_VIOLET }} />
          <Typography sx={{ fontSize: 18, fontWeight: 'bold' }}>
            {step === 'complete_link' ? 'Harvesting has been set up' : 'Harvesting has been stopped'}
          </Typography>
          {step === 'complete_link' && (
            <Typography sx={{ color: 'text.secondary', fontSize: 13, textAlign: 'center' }}>
              ノードでの反映まで数分かかる場合があります。
            </Typography>
          )}
          <Button variant="contained" disableElevation sx={{ bgcolor: SYMBOL_VIOLET, '&:hover': { bgcolor: SYMBOL_VIOLET } }} onClick={onFinish}>
            ハーベスト設定に戻る
          </Button>
        </Box>
      </Box>
    );
  }

  // step: status (default)
  const isLinked = !!(status?.linkedPublicKey && status?.vrfPublicKey && status?.nodePublicKey);

  return (
    <Box sx={{ width: '100vw', pb: `${SYMBOL_BOTTOM_NAV_HEIGHT}px` }}>
      <AppToolBar back="/symbol" title="Harvest settings" backColor={SYMBOL_VIOLET} />
      <WalletBar isOpened={false} />
      <SymbolHarvestHero />

      <Box sx={{ px: 2, mt: 2 }}>
        {statusLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : isLinked ? (
          <>
            <Typography sx={{ color: SYMBOL_VIOLET, fontWeight: 'bold' }}>Harvesting: Active</Typography>

            <Typography sx={{ color: SYMBOL_VIOLET, mt: 2 }}>Delegated node public key</Typography>
            <Typography sx={{ wordBreak: 'break-all', fontSize: 13 }}>{status?.nodePublicKey}</Typography>

            <Typography sx={{ color: SYMBOL_VIOLET, mt: 2 }}>Linked account (remote) public key</Typography>
            <Typography sx={{ wordBreak: 'break-all', fontSize: 13 }}>{status?.linkedPublicKey}</Typography>

            <Typography sx={{ color: SYMBOL_VIOLET, mt: 2 }}>VRF public key</Typography>
            <Typography sx={{ wordBreak: 'break-all', fontSize: 13 }}>{status?.vrfPublicKey}</Typography>

            <Button
              fullWidth
              variant="outlined"
              color="error"
              size="large"
              sx={{ mt: 3 }}
              onClick={onStartStop}
            >
              ハーベストを停止する
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
              sx={{ mt: 3, bgcolor: SYMBOL_VIOLET, '&:hover': { bgcolor: SYMBOL_VIOLET } }}
              onClick={onStartSetup}
            >
              ハーベストを設定する
            </Button>
          </>
        )}
      </Box>

      <SymbolBottomNav active="harvest" onHarvestClick={() => {}} hideOther />
      <ErrorSnackbar message={errorMessage} onClose={() => setErrorMessage('')} />
    </Box>
  );
}
