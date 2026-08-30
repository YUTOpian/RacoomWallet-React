import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

// The card ribbons ("Balance" / "Transaction" / "SWAP") used to be separate PNGs with the
// text baked in, each with a sharp cut corner (`4px 4px 4px 0`) - a hard "flag" shape typical
// of the app's original Material-2010s look. Rendered as a pill-shaped badge with a leading
// icon instead so it reads as more current, while keeping the same labels/colors
// (nemOrange/nemBlue/primary) that make each card recognizable at a glance. Shared between
// Home and TransactionList so both screens' Balance ribbons stay visually identical.
export default function CardRibbon({ text, bgcolor, icon }: { text: string; bgcolor: string; icon: ReactNode }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor, borderRadius: 999, px: 1.5, py: 0.5, ml: 2, mt: 2 }}>
      {icon}
      <Typography sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.8rem', lineHeight: 1 }}>{text}</Typography>
    </Box>
  );
}
