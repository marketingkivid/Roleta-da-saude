import { Button } from '@/components/ui/button';
import { Emoji, EmojiText } from '@/lib/twemoji';

const AlreadyPlayedScreen = () => (
  <div
    className="relative flex flex-col items-center justify-center min-h-[60vh] px-4 sm:px-6 lg:px-8 text-center max-w-md mx-auto w-full"
    style={{
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
    }}
  >
    <Emoji emoji="🦋" label="" className="text-6xl sm:text-7xl mb-4 sm:mb-6 block" />

    <h1 className="text-2xl sm:text-3xl font-black text-balance">Você já veio por aqui!</h1>
    <p className="mt-4 text-foreground/70 max-w-xs text-base sm:text-lg text-balance">
      <EmojiText>Cada link da roleta vale um giro — e você já usou o seu. 🎯</EmojiText>
    </p>
    <p className="mt-3 text-foreground/70 max-w-xs text-base sm:text-lg text-balance">
      <EmojiText>Mas fica de olho no seu e-mail: a Kivid solta roletas novas de tempos em tempos, sempre com prêmios diferentes. 💜</EmojiText>
    </p>

    <div className="mt-8 w-full max-w-xs">
      <Button variant="hero" size="lg" asChild>
        <a href="https://kivid.com.br" target="_blank" rel="noopener noreferrer">
          Conhecer o Kivid
        </a>
      </Button>
    </div>
  </div>
);

export default AlreadyPlayedScreen;
