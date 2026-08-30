import { Box, Button, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import heroSeclessonLarge from '../../assets/heroimage_seclesson_large.png';

export default function LessonBeginnerEnd() {
  const { t } = useTranslation();

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppToolBar back="/lesson/beginner_backup_end" title={t('lesson.beginner_end_title')} />
      <Box component="img" src={heroSeclessonLarge} sx={{ width: '100%' }} />
      <Box sx={{ mb: 5, mx: 2 }}>
        <Typography align="center">
          {(t('lesson.beginner_end_message', { returnObjects: true }) as string[]).map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pb: 4 }}>
        <Button component={Link} to="/top" variant="contained" color="primary" size="small">OK</Button>
      </Box>
    </Box>
  );
}
