import { Button } from '@/components/ui/button';
import ConfettiCanvas from '@/components/ConfettiCanvas';
import { Emoji, EmojiText } from '@/lib/twemoji';

import type { Prize } from '@/hooks/useCampaign';

interface RewardScreenProps {
  prize: Prize;
  participantName: string;
  onReset: () => void;
}

const RewardScreen = ({ prize, participantName, onReset }: RewardScreenProps) => {

  return (
    <div
      className="relative flex flex-col items-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full max-w-md sm:max-w-lg mx-auto"
      style={{
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      <ConfettiCanvas />

      <div className="w-40 h-40 sm:w-48 sm:h-48 lg:w-64 lg:h-64 rounded-2xl bg-primary/10 flex items-center justify-center mt-2 sm:mt-4 overflow-hidden animate-prize-reveal shrink-0">
        <img src={prize.image_url} alt={prize.name} className="w-32 h-32 sm:w-40 sm:h-40 lg:w-56 lg:h-56 object-contain" />
      </div>

      <p className="mt-4 text-xl sm:text-2xl lg:text-4xl font-black text-center"><Emoji emoji="🎉" label="" /> Você ganhou!</p>
      <p className="text-xl sm:text-2xl lg:text-4xl font-bold text-secondary mt-1 text-center leading-tight break-words w-full px-2">
        {prize.name}
      </p>


      <div className="w-full mt-6 bg-card border border-border rounded-2xl p-4 lg:p-8">
        <p className="text-base lg:text-xl font-medium mb-1 break-words">Parabéns, {participantName}! <Emoji emoji="🥳" label="" /></p>
        {prize.description && (
          <p className="text-sm sm:text-base lg:text-xl text-foreground/70 break-words">{prize.description}</p>
        )}
      </div>

      <p className="w-full mt-3 text-sm sm:text-base text-foreground/60 text-center break-words">
        <EmojiText>Fica de olho no seu e-mail: sempre tem roleta Kivid nova chegando, com prêmios diferentes. 🎁</EmojiText>
      </p>



      <div className="w-full mt-6 space-y-3">
        {prize.checkout_url && (() => {
          const isWhatsApp = /wa\.me|api\.whatsapp\.com/i.test(prize.checkout_url!);
          return (
            <Button size="lg" className="w-full rounded-full lg:text-lg lg:py-6" asChild>
              <a href={prize.checkout_url} {...(!isWhatsApp && { target: "_blank", rel: "noopener noreferrer" })}>
                Resgatar
              </a>
            </Button>
          );
        })()}
        <a
          href="https://kivid.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-base lg:text-xl font-bold text-primary hover:underline py-2"
        >
          Conhecer o Kivid →
        </a>
        <Button variant="link" size="sm" className="w-full no-underline text-foreground/60 hover:text-foreground/40 hover:no-underline text-sm" onClick={onReset}>
          ← Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default RewardScreen;
