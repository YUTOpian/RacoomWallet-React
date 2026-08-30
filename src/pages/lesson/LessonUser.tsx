import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import heroSeclessonLarge from '../../assets/heroimage_seclesson_large.png';

export default function LessonUser() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goWalletSelect = () => navigate('/wallet/creation/type');

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppToolBar back="/lesson/level" title={t('lesson.user_title')} />
      <Box component="img" src={heroSeclessonLarge} sx={{ width: '100%' }} />
      <Box sx={{ mb: 5, mx: 2 }}>
        <Typography align="center">
          {(t('lesson.user_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
        <Button variant="contained" color="primary" size="small" onClick={goWalletSelect}>OK</Button>
      </Box>
    </Box>
  );
}
