import { Button } from '@/components/ui/button';
import ConfettiCanvas from '@/components/ConfettiCanvas';
import { Emoji, EmojiText } from '@/lib/twemoji';
import type { Prize } from '@/hooks/useCampaign';

interface ResultScreenProps {
  /** true = vitória (recompensa) · false = derrota (consolação) */
  won: boolean;
  prize: Prize;
  participantName: string;
  /** "Voltar ao início" → encerra a participação (não volta para a roleta). */
  onReset: () => void;
}

const SIMULADOR_URL = 'https://kivid.com.br/simulador';
const KIVID_URL = 'https://kivid.com.br';

/**
 * Tela única de resultado — mesma estética para vitória e derrota.
 * Só mudam os textos e os links (regra do Igor).
 */
const ResultScreen = ({ won, prize, participantName, onReset }: ResultScreenProps) => {
  const firstName = (participantName || '').trim().split(' ')[0];
  const hasImage = !!(prize.image_url && prize.image_url.trim());
  const isWhatsApp = !!prize.checkout_url && /wa\.me|api\.whatsapp\.com/i.test(prize.checkout_url);

  const title = won ? 'Você ganhou!' : 'Não foi dessa vez…';
  const titleEmoji = won ? '🎉' : null;

  const subtitle = won
    ? `${firstName ? firstName + ', v' : 'V'}ocê garantiu: ${prize.name}. 🥳`
    : `${firstName ? firstName + ', a' : 'A'} sua chance nesta roleta acabou aqui. Mas a Kivid solta roleta nova de tempos em tempos — sempre com prêmios diferentes. 💜`;

  const primary = won
    ? prize.checkout_url
      ? { label: 'Resgatar meu prêmio →', href: prize.checkout_url, newTab: !isWhatsApp }
      : { label: 'Conhecer o Kivid →', href: KIVID_URL, newTab: true }
    : { label: 'Ver o simulador Kivid →', href: SIMULADOR_URL, newTab: true };

  const secondary = won
    ? { label: 'Conhecer o Kivid', href: KIVID_URL }
    : { label: 'Ver mais promoções', href: KIVID_URL };

  return (
    <div
      className="relative flex flex-col items-center px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-md lg:max-w-xl mx-auto w-full"
      style={{
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      {won && <ConfettiCanvas />}

      <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-muted flex items-center justify-center mt-2 sm:mt-4 overflow-hidden animate-prize-reveal shrink-0">
        {hasImage ? (
          <img src={prize.image_url} alt="" className="w-24 h-24 sm:w-32 sm:h-32 object-contain" />
        ) : (
          <Emoji emoji={won ? (prize.emoji || '🎁') : '🍀'} label="" size={72} />
        )}
      </div>

      <p className="mt-6 text-2xl sm:text-3xl font-black text-center text-balance">
        {titleEmoji && <><Emoji emoji={titleEmoji} label="" /> </>}{title}
      </p>

      <p className="mt-2 text-base sm:text-lg text-foreground/70 text-center text-balance max-w-sm">
        <EmojiText>{subtitle}</EmojiText>
      </p>

      {prize.description && (
        <div className="w-full mt-5 bg-muted rounded-xl p-4 sm:p-5">
          <p className="text-base sm:text-lg text-foreground/70 break-words text-center">{prize.description}</p>
        </div>
      )}

      <div className="w-full mt-6 sm:mt-8 space-y-3">
        <Button size="lg" className="w-full rounded-full lg:text-lg lg:py-6" asChild>
          <a
            href={primary.href}
            {...('newTab' in primary && primary.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {primary.label}
          </a>
        </Button>
        <a
          href={secondary.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-base font-bold text-primary hover:underline py-2"
        >
          {secondary.label}
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

export default ResultScreen;
