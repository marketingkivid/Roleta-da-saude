import { cn } from '@/lib/utils';

interface ProgressBarProps {
  currentStep: 'validation' | 'game' | 'reward' | 'consolation';
}

// Fluxo da roleta (2 etapas visíveis ao jogador):
// 1) Seus dados → preencher o formulário (tela 'validation')
// 2) Girar → girar a roleta e ver o resultado (telas 'game', 'reward', 'consolation')
const STEPS = [
  { id: 'dados', label: 'Seus dados' },
  { id: 'girar', label: 'Girar' },
] as const;

const stepIndex = (current: ProgressBarProps['currentStep']) => {
  if (current === 'validation') return 0;
  // game, reward e consolation → etapa "Girar" (concluída nas telas de resultado)
  return 1;
};

const ProgressBar = ({ currentStep }: ProgressBarProps) => {
  const current = stepIndex(currentStep);
  const currentLabel = STEPS[current]?.label ?? '';

  return (
    <div
      className="w-full px-4 sm:px-6 lg:px-8 py-2 sm:py-3 max-w-2xl mx-auto"
      role="progressbar"
      aria-label="Progresso da participação"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuetext={`Passo ${current + 1} de ${STEPS.length}: ${currentLabel}`}
    >
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex-1 flex items-center gap-1">
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-out',
                  i <= current ? 'bg-primary w-full' : 'w-0'
                )}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {STEPS.map((step, i) => (
          <span
            key={step.id}
            className={cn(
              'text-xs font-medium transition-colors',
              i <= current ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
