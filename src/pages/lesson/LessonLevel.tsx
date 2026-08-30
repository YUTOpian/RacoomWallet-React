import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppToolBar from '../../components/AppToolBar';
import heroSeclessonSmall from '../../assets/heroimage_seclesson_small.png';
import cardBeginner from '../../assets/image_lesson_card1.png';
import cardLogin from '../../assets/image_lesson_card2.png';
import cardUser from '../../assets/image_lesson_card3.png';

export default function LessonLevel() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = [
    { image: cardBeginner, title: t('lesson.level_beginner_title'), setup: t('lesson.level_beginner_setup'), message: t('lesson.level_beginner_message'), to: '/lesson/beginner' },
    { image: cardLogin, title: t('lesson.level_login_title'), setup: t('lesson.level_login_setup'), message: t('lesson.level_login_message'), to: '/lesson/login' },
    { image: cardUser, title: t('lesson.level_user_title'), setup: t('lesson.level_user_setup'), message: t('lesson.level_user_message'), to: '/lesson/user' },
  ];

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppToolBar back="/lesson/introduction" title={t('lesson.level_title')} />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box component="img" src={heroSeclessonSmall} sx={{ width: '100%', height: 'auto', display: 'block' }} />
        <Box sx={{ px: 2, pt: 3 }}>
          {items.map((item) => (
            <Card key={item.image} sx={{ mb: 3 }}>
              <CardActionArea
                onClick={() => navigate(item.to)}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr',
                  columnGap: 1,
                  alignItems: 'start',
                  minHeight: 96,
                }}
              >
                <Box
                  component="img"
                  src={item.image}
                  sx={{ width: 64, height: '100%', minHeight: 96, objectFit: 'cover', display: 'block' }}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', py: 1.5, pr: 2 }}>
                  <Typography sx={{ color: 'primary.main' }}>{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.setup}</Typography>
                  <Typography sx={{ mt: 1.5 }}>{item.message}</Typography>
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
