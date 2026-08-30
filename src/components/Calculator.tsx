import { useRef } from 'react';
import { Box, Card } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { evaluateArithmetic } from '../lib/arithmetic';

interface CalculatorProps {
  to?: string;
}

const values = [
  '', '→', 'CE', '=',
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '+',
  '.', '0', '⌫', '-',
];

/**
 * Ported from src/components/parts/Calculator.vue. Behavior (formula building, `eval`-based
 * calculation on '=', digit-only fast path for the send-amount screens) is kept identical —
 * only the rendering layer moved from Vuetify to MUI.
 */
export default function Calculator({ to = '' }: CalculatorProps) {
  const navigate = useNavigate();
  const formula = useAppStore((s) => s.calculatorFormula);
  const setCalculatorFormula = useAppStore((s) => s.setCalculatorFormula);
  const appendCalculatorFormula = useAppStore((s) => s.appendCalculatorFormula);
  const dropCalculatorFormula = useAppStore((s) => s.dropCalculatorFormula);
  const clearCalculatorFormula = useAppStore((s) => s.clearCalculatorFormula);
  const setCalculatorValue = useAppStore((s) => s.setCalculatorValue);

  // `calculated` tracks whether the last action was "=" (or the initial state), so the
  // next digit tap starts a fresh formula instead of appending to the old result —
  // matching the Vue version's local `calculated` flag. A ref (not state) is correct here:
  // it's write-then-read-on-next-click bookkeeping that should never itself trigger a
  // re-render.
  const calculatedRef = useRef(true);

  const canGo = isFinite(Number(formula));

  const onTouched = (value: string) => {
    if (calculatedRef.current) {
      clearCalculatorFormula();
      calculatedRef.current = false;
    }

    if (value === 'CE') {
      clearCalculatorFormula();
    } else if (value === '=') {
      const expr = formula.split('×').join('*').split('÷').join('/');
      try {
        const result = evaluateArithmetic(expr);
        setCalculatorFormula(result.toString());
        calculatedRef.current = true;
      } catch {
        // invalid formula — leave as-is, same as the Vue version's empty catch
      }
    } else if (value === '⌫') {
      dropCalculatorFormula();
    } else {
      appendCalculatorFormula(value);
    }

    const nextFormula = useAppStore.getState().calculatorFormula;
    const numeric = Number(nextFormula);
    if (isFinite(numeric)) {
      setCalculatorValue(numeric);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
      <Box sx={{ bgcolor: 'white', width: '100%', maxWidth: 480 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {values.map((value, index) => {
          const isOperatorRow = index % 4 === 3;
          const key = `${index}-${value}`;

          if (value === '') {
            return (
              <Box key={key} sx={{ width: '25%' }}>
                <Card sx={{ border: '1px solid', borderColor: 'divider' }} elevation={0}>
                  <Box sx={{ fontSize: 'x-large', textAlign: 'center', p: 1 }}>&nbsp;</Box>
                </Card>
              </Box>
            );
          }

          if (value === '→') {
            return (
              <Box key={key} sx={{ width: '25%' }}>
                <Card
                  sx={{ border: '1px solid', borderColor: 'divider', bgcolor: canGo ? 'orange' : 'grey.500', cursor: canGo ? 'pointer' : 'default' }}
                  elevation={0}
                  onClick={() => canGo && to && navigate(to)}
                >
                  <Box sx={{ fontSize: 'x-large', textAlign: 'center', color: 'white', p: 1 }}>{value}</Box>
                </Card>
              </Box>
            );
          }

          return (
            <Box key={key} sx={{ width: '25%' }}>
              <Card
                sx={{ border: '1px solid', borderColor: 'divider', bgcolor: isOperatorRow ? 'primary.main' : 'white', cursor: 'pointer' }}
                elevation={0}
                onClick={() => onTouched(value)}
              >
                <Box sx={{ fontSize: 'x-large', textAlign: 'center', fontWeight: 'bold', color: isOperatorRow ? 'white' : 'inherit', p: 1 }}>
                  {value}
                </Box>
              </Card>
            </Box>
          );
        })}
      </Box>
      </Box>
    </Box>
  );
}
