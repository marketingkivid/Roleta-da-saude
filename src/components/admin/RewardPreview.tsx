import { Emoji } from '@/lib/twemoji';

interface RewardPreviewProps {
  name: string;
  description: string;
  redeem_instructions: string;
  imageUrl: string;
  checkoutUrl?: string;
}

const RewardPreview = ({ name, description, redeem_instructions, imageUrl, checkoutUrl }: RewardPreviewProps) => {
  const hasValidUrl = checkoutUrl && /^https?:\/\/.+/.test(checkoutUrl);

  return (
    <div className="flex flex-col items-center text-center" style={{ fontFamily: 'Nunito, sans-serif', transform: 'scale(0.6)', transformOrigin: 'top center' }}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          width: 192,
          height: 192,
          borderRadius: 16,
          background: 'hsl(var(--primary) / 0.1)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} style={{ width: 160, height: 160, objectFit: 'contain' }} />
        ) : (
          <Emoji emoji="📷" label="" size={64} />
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 24, fontWeight: 900 }}><Emoji emoji="🎉" label="" /> Você ganhou!</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: 'hsl(var(--secondary))', marginTop: 4 }}>
        {name || 'Nome do prêmio'}
      </p>

      <div
        style={{
          width: '100%',
          marginTop: 24,
          background: 'hsl(var(--muted))',
          borderRadius: 12,
          padding: '16px 20px',
          textAlign: 'left',
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Parabéns, Participante! <Emoji emoji="🥳" label="" /></p>
        <p style={{ fontSize: 16, color: 'hsl(var(--foreground) / 0.7)' }}>
          {description || 'Descrição do prêmio'}
        </p>
      </div>


      {hasValidUrl && (
        <div
          style={{
            width: '100%',
            marginTop: 16,
            background: 'hsl(var(--secondary))',
            color: '#fff',
            borderRadius: 8,
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: 16,
            textAlign: 'center',
          }}
        >
          Resgatar
        </div>
      )}
    </div>
  );
};

export default RewardPreview;
