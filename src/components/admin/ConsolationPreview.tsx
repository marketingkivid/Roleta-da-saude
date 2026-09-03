interface ConsolationPreviewProps {
  name: string;
  description: string;
  imageUrl: string;
}

const ConsolationPreview = ({ name, description, imageUrl }: ConsolationPreviewProps) => {
  return (
    <div className="flex flex-col items-center text-center" style={{ fontFamily: 'Nunito, sans-serif', transform: 'scale(0.6)', transformOrigin: 'top center' }}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          width: 192,
          height: 192,
          borderRadius: 16,
          background: '#F3F4F6',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} style={{ width: 160, height: 160, objectFit: 'contain' }} />
        ) : (
          <span style={{ fontSize: 64, color: '#9B8FAE' }}>📷</span>
        )}
      </div>

      <p style={{ marginTop: 20, fontSize: 24, fontWeight: 900 }}>😢 Não foi dessa vez…</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#5A5A7A', marginTop: 4 }}>
        {name || 'Nome do prêmio'}
      </p>

      <div
        style={{
          width: '100%',
          marginTop: 24,
          background: '#F3F4F6',
          borderRadius: 12,
          padding: '16px 20px',
          textAlign: 'left',
        }}
      >
        <p style={{ fontSize: 16, color: '#5A5A7A' }}>
          {description || 'Descrição de consolação'}
        </p>
      </div>
    </div>
  );
};

export default ConsolationPreview;
