import { Button } from '@/components/ui/button';

interface AlreadyPlayedScreenProps {
  onReset: () => void;
}

const AlreadyPlayedScreen = ({ onReset }: AlreadyPlayedScreenProps) => (
  <div
    className="relative flex flex-col items-center justify-center min-h-[60vh] px-4 sm:px-6 lg:px-8 text-center max-w-md mx-auto w-full"
    style={{
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
    }}
  >
    <span className="text-6xl sm:text-7xl mb-4 sm:mb-6" aria-hidden="true">🦋</span>

    <h1 className="text-2xl sm:text-3xl font-black text-balance">Você já veio por aqui!</h1>
    <p className="mt-4 text-foreground/70 max-w-xs text-base sm:text-lg text-balance">
      Ficamos felizes que participou da nossa surpresa. Continue cuidando da sua saúde com a gente! 💜
    </p>

    <div className="mt-8 w-full max-w-xs space-y-3">
      <Button variant="hero" size="lg" asChild>
        <a href="https://kivid.com.br" target="_blank" rel="noopener noreferrer">
          Conhecer o Kivid
        </a>
      </Button>
      <Button variant="link" size="sm" className="w-full no-underline text-foreground/60 hover:text-foreground/40 hover:no-underline" onClick={onReset}>
        <span aria-hidden="true">←</span> Voltar ao início
      </Button>
    </div>
  </div>
);


export default AlreadyPlayedScreen;
