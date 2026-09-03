import { Button } from '@/components/ui/button';
import { Emoji } from '@/lib/twemoji';

interface LandingScreenProps {
  onStart: () => void;
}

const LandingScreen = ({ onStart }: LandingScreenProps) => {
  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-[70vh] px-4 sm:px-6 lg:px-8 text-center overflow-hidden w-full max-w-2xl mx-auto"
      style={{
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <div className="relative mb-4 inline-block" aria-hidden="true">
        <Emoji emoji="🍀" label="" className="text-7xl sm:text-8xl md:text-9xl inline-block animate-clover-sway" />
        <Emoji emoji="🦋" label="" className="absolute -top-2 -left-6 text-2xl sm:text-3xl animate-butterfly-1 select-none" />
        <Emoji emoji="🦋" label="" className="absolute -top-4 -right-4 sm:-right-6 text-2xl sm:text-3xl animate-butterfly-2 select-none" />
        <Emoji emoji="🦋" label="" className="absolute bottom-0 -right-8 text-xl sm:text-2xl animate-butterfly-3 select-none" />
      </div>

      <h1 className="text-[1.75rem] leading-[1.1] sm:text-4xl md:text-5xl sm:leading-tight font-black max-w-[320px] sm:max-w-md md:max-w-2xl relative z-10 text-balance">
        Gire a roleta e ganhe{' '}
        <span className="inline sm:hidden"><br /></span>
        prêmios com o Kivid
      </h1>


      <p className="mt-4 text-base sm:text-lg text-foreground/70 font-light max-w-[320px] sm:max-w-sm relative z-10 text-balance">
        Um giro, um prêmio garantido. Vai encarar?
      </p>

      <div className="w-full max-w-sm mt-8 relative z-10">
        <Button variant="hero" size="lg" onClick={onStart}>
          Quero girar a roleta
        </Button>
      </div>

      <p className="mt-4 text-sm sm:text-base text-foreground/70 relative z-10">
        Você tem uma chance. Boa sorte!
      </p>
    </div>
  );
};

export default LandingScreen;
