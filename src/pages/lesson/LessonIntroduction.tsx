import { Box, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AppToolBar from '../../components/AppToolBar';
import { useAppStore } from '../../store/appStore';
import heroSeclessonLarge from '../../assets/heroimage_seclesson_large.png';

export default function LessonIntroduction() {
  const { t } = useTranslation();
  const backPathFromLesson = useAppStore((s) => s.backPathFromLesson);

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppToolBar back={backPathFromLesson} title={t('common.security_lesson')} />
      <Box component="img" src={heroSeclessonLarge} sx={{ width: '100%' }} />
      <Box sx={{ mb: 5 }}>
        <Typography align="center">
          {t('lesson.introduction_message_0')}<br />{t('lesson.introduction_message_1')}<br />{t('lesson.introduction_message_2')}
        </Typography>
        <Typography align="center" sx={{ mt: 1 }}>
          {t('lesson.introduction_message_3')}<br />{t('lesson.introduction_message_4')}<br />{t('lesson.introduction_message_5')}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
        <Button component={Link} to="/lesson/level" variant="contained" color="primary" size="small">OK</Button>
      </Box>
    </Box>
  );
}
