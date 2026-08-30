import { Box, Button, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoPyoko from '../assets/logo_pyoko.png';
import { useAppStore } from '../store/appStore';
import type { AppLanguage } from '../store/appStore';

// アプリを一番最初に起動したとき、またはウォレットが1件も無いときに表示するウェルカム画面。
// ここでの唯一のアクションは「GET STARTED」で、レッスン画面（/lesson/introduction）へ進む。
// GET STARTEDボタンの下には言語切替トグル（日本語／English）を設置。切替はSettingsTop.tsx
// と同じsetLanguage（i18n.changeLanguage + zustand永続化）を使うため、ここで選んだ言語は
// アプリ全体・以降の起動時にも引き継がれる。
export default function Welcome() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  const onChangeLanguage = (_: React.MouseEvent<HTMLElement>, value: AppLanguage | null) => {
    if (value) setLanguage(value);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        bgcolor: 'primary.main',
        color: '#fff',
        textAlign: 'center',
        px: 4,
        overflow: 'hidden',
      }}
    >
      <Box
        component="img"
        src={logoPyoko}
        alt="Raccoon Wallet"
        sx={{ width: 140, height: 140, mb: 4 }}
      />

      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
        {t('wallet.welcome_title_1')}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.4, mb: 2 }}>
        {t('wallet.welcome_title_2')}
      </Typography>

      <Typography variant="body2" sx={{ opacity: 0.85, mb: 6 }}>
        {t('wallet.welcome_subtitle')}
      </Typography>

      <Button
        variant="contained"
        onClick={() => navigate('/lesson/introduction')}
        sx={{
          width: '100%',
          maxWidth: 320,
          py: 1.5,
          bgcolor: '#fff',
          color: 'primary.main',
          fontWeight: 700,
          '&:hover': { bgcolor: '#f0f0f0' },
        }}
      >
        {t('wallet.welcome_get_started')}
      </Button>

      <ToggleButtonGroup
        value={language}
        exclusive
        onChange={onChangeLanguage}
        size="small"
        sx={{
          mt: 3,
          bgcolor: 'rgba(255,255,255,0.15)',
          borderRadius: 999,
          p: 0.5,
          '& .MuiToggleButton-root': {
            border: 'none',
            borderRadius: 999,
            px: 2.5,
            py: 0.5,
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            '&.Mui-selected': {
              bgcolor: '#fff',
              color: 'primary.main',
              '&:hover': { bgcolor: '#f0f0f0' },
            },
          },
        }}
      >
        <ToggleButton value="ja">{t('settings.language_name_ja')}</ToggleButton>
        <ToggleButton value="en">{t('settings.language_name_en')}</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
