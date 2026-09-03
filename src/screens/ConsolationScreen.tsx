import { Button } from '@/components/ui/button';
import { Emoji, EmojiText } from '@/lib/twemoji';
import type { Prize } from '@/hooks/useCampaign';

interface ConsolationScreenProps {
  prize: Prize;
  participantName: string;
  onReset: () => void;
}

const SIMULADOR_URL = 'https://kivid.com.br/simulador';

const ConsolationScreen = ({ prize, participantName, onReset }: ConsolationScreenProps) => {
  const firstName = (participantName || '').trim().split(' ')[0];
  const hasImage = !!(prize.image_url && prize.image_url.trim());

  return (
    <div
      className="relative flex flex-col items-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-md lg:max-w-xl mx-auto w-full"
      style={{
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-muted flex items-center justify-center mt-2 sm:mt-4 overflow-hidden animate-prize-reveal shrink-0">
        {hasImage ? (
          <img src={prize.image_url} alt="" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
        ) : (
          <Emoji emoji="🍀" label="" size={72} />
        )}
      </div>

      <p className="mt-6 text-2xl sm:text-3xl font-black text-center">Não foi dessa vez…</p>
      <p className="mt-2 text-base sm:text-lg text-foreground/70 text-center text-balance max-w-sm">
        <EmojiText>{`${firstName ? firstName + ', a' : 'A'} sua chance nesta roleta acabou aqui. Mas a Kivid solta roleta nova de tempos em tempos — sempre com prêmios diferentes. 💜`}</EmojiText>
      </p>

      {prize.description && (
        <div className="w-full mt-5 bg-muted rounded-xl p-4 sm:p-5">
          <p className="text-base sm:text-lg text-foreground/70 break-words text-center">{prize.description}</p>
        </div>
      )}

      <div className="w-full mt-6 sm:mt-8 space-y-3">
        <Button size="lg" className="w-full rounded-full lg:text-lg lg:py-6" asChild>
          <a href={SIMULADOR_URL} target="_blank" rel="noopener noreferrer">
            Ver o simulador Kivid →
          </a>
        </Button>
        <a
          href="https://kivid.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-base font-bold text-primary hover:underline py-2"
        >
          Ver mais promoções
        </a>
        <Button
          variant="link"
          size="sm"
          className="w-full no-underline text-foreground/60 hover:text-foreground/40 hover:no-underline"
          onClick={onReset}
        >
          <span aria-hidden="true">←</span> Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default ConsolationScreen;
