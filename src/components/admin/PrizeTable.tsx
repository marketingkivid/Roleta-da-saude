import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PrizeForm from './PrizeForm';
import type { Tables } from '@/integrations/supabase/types';

type Prize = Tables<'prizes'>;

interface PrizeTableProps {
  prizes: Prize[];
  onUpdate: () => void;
}

const PrizeTable = ({ prizes, onUpdate }: PrizeTableProps) => {
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [showForm, setShowForm] = useState(false);

  const toggleActive = async (prize: Prize) => {
    await supabase.from('prizes').update({ active: !prize.active }).eq('id', prize.id);
    onUpdate();
  };

  const handleSave = () => {
    setEditingPrize(null);
    setShowForm(false);
    onUpdate();
  };

  if (showForm || editingPrize) {
    return (
      <PrizeForm
        prize={editingPrize}
        onSave={handleSave}
        onCancel={() => { setEditingPrize(null); setShowForm(false); }}
      />
    );
  }

  if (prizes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Nunito, sans-serif' }}>Prêmios cadastrados</h2>
        </div>
        <div
          className="flex flex-col items-center justify-center py-16"
          style={{
            background: '#FFFFFF',
            borderRadius: 20,
            border: '0.5px solid #E8E0EE',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          <span style={{ fontSize: 48, marginBottom: 12 }}>🎁</span>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>Nenhum prêmio cadastrado</p>
          <p style={{ fontSize: 14, color: '#9B8FAE', marginBottom: 20 }}>Crie seu primeiro prêmio para começar</p>
          <button
            onClick={() => setShowForm(true)}
            className="transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: '#E8357A',
              color: '#fff',
              borderRadius: 50,
              padding: '12px 28px',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
            }}
          >
            + Criar primeiro prêmio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', fontFamily: 'Nunito, sans-serif' }}>Prêmios cadastrados</h2>
        <button
          onClick={() => setShowForm(true)}
          className="transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: '#E8357A',
            color: '#fff',
            borderRadius: 50,
            padding: '9px 22px',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          + Novo prêmio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {prizes.map((p) => {
          const isConsolation = (p as any).is_consolation === true;
          const stockDepleted = p.quantity_available != null && (p.quantity_distributed ?? 0) >= p.quantity_available && p.active;

          return (
            <div
              key={p.id}
              style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: isConsolation ? '2px dashed #9B8FAE' : '0.5px solid #E8E0EE',
                fontFamily: 'Nunito, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Image */}
              <div
                className="flex items-center justify-center"
                style={{
                  height: 160,
                  background: isConsolation ? '#F3F4F6' : '#FFF5F8',
                  borderBottom: '0.5px solid #E8E0EE',
                }}
              >
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ maxHeight: 130, maxWidth: '80%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: 56 }}>{p.emoji}</span>
                )}
              </div>

              {/* Body */}
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E' }}>{p.name}</span>

                  {/* Status badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 50,
                      padding: '2px 10px',
                      background: p.active ? '#E8FAF0' : '#F3F4F6',
                      color: p.active ? '#1a7a47' : '#9B8FAE',
                    }}
                  >
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>

                  {isConsolation && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 50,
                        padding: '2px 10px',
                        background: '#FEF3CD',
                        color: '#856404',
                      }}
                    >
                      Não foi dessa vez
                    </span>
                  )}

                  {stockDepleted && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 50,
                        padding: '2px 10px',
                        background: '#FDECEA',
                        color: '#B71C1C',
                      }}
                    >
                      Estoque esgotado
                    </span>
                  )}
                </div>

                <p className="line-clamp-2" style={{ fontSize: 14, color: '#5A5A7A', marginBottom: 12, flex: 1 }}>
                  {p.description ? p.description : <em style={{ color: '#9B8FAE' }}>Sem descrição</em>}
                </p>

                {/* Mapping chips */}
                {!isConsolation && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      { label: 'Nome → título', present: true },
                      { label: 'Descrição → parabéns', present: !!p.description },
                      { label: 'Instruções → resgate', present: !!p.redeem_instructions },
                      { label: 'URL → cupom', present: !!p.checkout_url },
                    ].map((chip) => (
                      <span
                        key={chip.label}
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 50,
                          padding: '2px 8px',
                          background: chip.present ? '#EDE9F3' : '#F9F9F9',
                          color: chip.present ? '#6B5B8A' : '#C5BDD0',
                          border: `1px solid ${chip.present ? '#E8E0EE' : '#ECECEC'}`,
                        }}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-4" style={{ fontSize: 13, color: '#9B8FAE' }}>
                  <span>Peso: <strong style={{ fontFamily: 'monospace', color: '#1A1A2E' }}>{p.weight}</strong></span>
                  <span>
                    Estoque:{' '}
                    <strong style={{ color: '#1A1A2E' }}>
                      {p.quantity_available != null ? `${p.quantity_distributed}/${p.quantity_available}` : '∞'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div
                className="flex gap-2 px-5 py-3"
                style={{ borderTop: '0.5px solid #E8E0EE' }}
              >
                <button
                  onClick={() => setEditingPrize(p)}
                  className="transition-all hover:opacity-80 flex items-center gap-1.5"
                  style={{
                    background: '#FFFFFF',
                    color: '#5A5A7A',
                    border: '1.5px solid #E8E0EE',
                    borderRadius: 50,
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="transition-all hover:opacity-80 flex items-center gap-1.5"
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #E8E0EE',
                    borderRadius: 50,
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                    color: p.active ? '#B71C1C' : '#1a7a47',
                  }}
                >
                  {p.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrizeTable;
