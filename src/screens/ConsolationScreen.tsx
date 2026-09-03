import { Button } from '@/components/ui/button';
import { Emoji } from '@/lib/twemoji';
import type { Prize } from '@/hooks/useCampaign';

interface ConsolationScreenProps {
  prize: Prize;
  participantName: string;
  onReset: () => void;
}

const ConsolationScreen = ({ prize, participantName, onReset }: ConsolationScreenProps) => {
  return (
    <div
      className="relative flex flex-col items-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-md lg:max-w-xl mx-auto w-full"
      style={{
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <div className="w-40 h-40 sm:w-48 sm:h-48 lg:w-64 lg:h-64 rounded-2xl bg-muted flex items-center justify-center mt-2 sm:mt-4 overflow-hidden shadow-lg animate-prize-reveal shrink-0">
        <img src={prize.image_url} alt={prize.name} className="w-32 h-32 sm:w-40 sm:h-40 lg:w-56 lg:h-56 object-contain" />
      </div>

      <p className="mt-6 text-xl sm:text-2xl lg:text-4xl font-black text-center"><Emoji emoji="😢" label="" /> Não foi dessa vez…</p>
      <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-muted-foreground mt-1 text-center break-words w-full px-2">
        {prize.name}
      </p>


      <div className="w-full mt-6 sm:mt-8 bg-muted rounded-xl p-4 sm:p-5 lg:p-8">
        <p className="text-base sm:text-lg lg:text-xl font-medium mb-1 break-words">{participantName}, não desanime! <Emoji emoji="💪" label="" /></p>
        <p className="text-base sm:text-lg lg:text-xl text-foreground/70 break-words">{prize.description}</p>
      </div>

      <div className="w-full mt-6 sm:mt-8 space-y-3">
        <Button size="lg" className="w-full rounded-full lg:text-lg lg:py-6" asChild>
          <a href="https://kivid.com.br/simulador" target="_blank" rel="noopener noreferrer">
            Veja mais ofertas
          </a>
        </Button>
        <Button variant="link" size="sm" className="w-full no-underline text-foreground/60 hover:text-foreground/40 hover:no-underline" onClick={onReset}>
          ← Voltar ao início
        </Button>
      </div>

    </div>
  );
};

export default ConsolationScreen;
