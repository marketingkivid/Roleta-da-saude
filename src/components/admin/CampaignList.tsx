import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Pencil, Trash2, Link2, Zap, PauseCircle, ChevronLeft, ChevronRight, Copy, FileEdit, FlaskConical, Rocket } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Emoji } from '@/lib/twemoji';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCampaignData } from '@/hooks/useCampaignData';
import { useIsMobile } from '@/hooks/use-mobile';
import { FONT } from '@/lib/admin-styles';

interface CampaignListProps {
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #E8E0EE',
  borderRadius: 20,
  padding: '10px 16px 10px 40px',
  fontSize: 15,
  ...FONT,
  background: '#FFFFFF',
  color: '#1A1A2E',
  outline: 'none',
  width: '100%',
  maxWidth: 320,
};

const pillStyle = (active: boolean): React.CSSProperties => ({
  ...FONT,
  fontSize: 13,
  fontWeight: 700,
  borderRadius: 50,
  padding: '6px 16px',
  cursor: 'pointer',
  border: '1.5px solid',
  borderColor: active ? '#E8357A' : '#E8E0EE',
  background: active ? '#E8357A' : '#FFFFFF',
  color: active ? '#FFFFFF' : '#5A5A7A',
  transition: 'all .15s',
});

type StatusFilter = 'all' | 'active' | 'paused' | 'draft';
const PAGE_SIZE = 10;

type CampaignStatus = 'active' | 'paused' | 'draft';

const statusBadgeStyles: Record<CampaignStatus, React.CSSProperties> = {
  active: { background: '#ECFDF5', color: '#1a7a47', border: '1px solid #BBF7D0', fontSize: 11, fontWeight: 700, borderRadius: 50, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 },
  paused: { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize: 11, fontWeight: 700, borderRadius: 50, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 },
  draft: { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB', fontSize: 11, fontWeight: 700, borderRadius: 50, padding: '2px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 },
};

const testBadgeStyle: React.CSSProperties = {
  background: '#FEF3C7', color: '#92400E', border: '1px dashed #F59E0B',
  fontSize: 11, fontWeight: 700, borderRadius: 50, padding: '2px 10px',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};


const CampaignList = ({ onEdit, onDuplicate }: CampaignListProps) => {
  const isMobile = useIsMobile();
  const { campaigns, participantCounts, prizeCounts, loading, refetch } = useCampaignData();
  const [deleteTarget, setDeleteTarget] = useState<typeof campaigns[0] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);

  const getStatus = (c: typeof campaigns[0]): CampaignStatus => {
    if (c.active) return 'active';
    return (prizeCounts[c.id] || 0) > 0 ? 'paused' : 'draft';
  };

  const filtered = useMemo(() => {
    let list = campaigns;
    if (statusFilter === 'active') list = list.filter(c => c.active);
    if (statusFilter === 'paused') list = list.filter(c => !c.active && (prizeCounts[c.id] || 0) > 0);
    if (statusFilter === 'draft') list = list.filter(c => !c.active && (prizeCounts[c.id] || 0) === 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.campaign_type.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, search, statusFilter, prizeCounts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const toggleActive = async (c: typeof campaigns[0]) => {
    const { error } = await supabase.from('campaigns').update({ active: !c.active }).eq('id', c.id);
    if (error) { toast.error('Erro ao atualizar campanha'); return; }
    toast.success(!c.active ? 'Campanha ativa' : 'Campanha pausada');
    refetch();
  };

  const copyLink = (c: typeof campaigns[0]) => {
    const slug = c.slug || c.id;
    const link = `https://roletadsaude.lovable.app/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', deleteTarget.id);
    if (error) { toast.error('Erro ao excluir campanha'); } else { toast.success('Campanha excluída'); }
    setDeleteTarget(null);
    refetch();
  };

  const renderMobileCard = (c: typeof campaigns[0]) => {
    const isTest = !!(c as any).is_test;
    return (
      <div
        key={c.id}
        style={{
          background: isTest ? '#FFFBEB' : '#FFFFFF',
          borderRadius: 20,
          border: isTest ? '1.5px dashed #F59E0B' : '0.5px solid #E8E0EE',
          padding: 16,
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="truncate" style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', ...FONT }}>{c.name}</span>
              {isTest && (
                <span style={testBadgeStyle}><FlaskConical size={10} /> Teste</span>
              )}
              {!c.active && (
                <span style={statusBadgeStyles[getStatus(c)]}>
                  {getStatus(c) === 'paused' ? <><PauseCircle size={10} /> Pausada</> : <><FileEdit size={10} /> Rascunho</>}
                </span>
              )}
              <button onClick={() => copyLink(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', padding: 2, flexShrink: 0 }}>
                <Link2 size={13} />
              </button>
            </div>
            {c.slug && (
              <p style={{ fontSize: 11, color: '#9B8FAE', fontFamily: 'monospace', marginTop: 2 }}>/{c.slug}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              checked={c.active}
              onCheckedChange={() => toggleActive(c)}
              className="data-[state=checked]:bg-[#22C55E] data-[state=unchecked]:bg-[#E8E0EE] scale-90"
            />
            <span className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, color: c.active ? '#1a7a47' : '#9B8FAE', ...FONT }}>
              {c.active ? <Zap size={10} /> : <PauseCircle size={10} />}
              {c.active ? 'Ativa' : 'Pausada'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3" style={{ fontSize: 12, color: '#5A5A7A', ...FONT }}>
          <span>{c.campaign_type}</span>
          <span>{new Date(c.start_date).toLocaleDateString('pt-BR')} — {new Date(c.end_date).toLocaleDateString('pt-BR')}</span>
          <span style={{ fontWeight: 700, color: '#1A1A2E' }}>{participantCounts[c.id] || 0} participantes</span>
        </div>

        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F3F4F6' }}>
          <button onClick={() => onEdit(c.id)} className="transition-all hover:opacity-80"
            style={{ background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, ...FONT }}>
            <Pencil size={12} /> Editar
          </button>
          <button onClick={() => onDuplicate(c.id)} className="transition-all hover:opacity-80"
            style={{ background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, ...FONT }}>
            <Copy size={12} /> Duplicar
          </button>
          <button onClick={() => setDeleteTarget(c)} className="transition-all hover:opacity-80 ml-auto"
            style={{ background: '#FFFFFF', color: '#EF4444', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, ...FONT }}>
            <Trash2 size={12} /> Excluir
          </button>
        </div>
      </div>
    );
  };

  const renderDesktopTable = (rows: typeof campaigns) => (
    <div className="overflow-x-auto">
      <table className="w-full" style={FONT}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E8E0EE' }}>
            {['NOME', 'TIPO', 'PERÍODO', 'PARTICIPANTES', 'STATUS', 'AÇÕES'].map(h => (
              <th key={h} className="text-left px-4 py-3" style={{ fontSize: 13, fontWeight: 400, color: '#9B8FAE', letterSpacing: 0.5 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const isTest = !!(c as any).is_test;
            return (
              <tr key={c.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <td className="px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E' }}>{c.name}</span>
                      {isTest && (
                        <span style={testBadgeStyle}><FlaskConical size={10} /> Teste</span>
                      )}
                      {!c.active && (
                        <span style={statusBadgeStyles[getStatus(c)]}>
                          {getStatus(c) === 'paused' ? <><PauseCircle size={10} /> Pausada</> : <><FileEdit size={10} /> Rascunho</>}
                        </span>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button onClick={() => copyLink(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', padding: 2 }} className="hover:opacity-70 transition-opacity">
                            <Link2 size={14} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar link</TooltipContent>
                      </Tooltip>
                    </div>
                    {c.slug && (
                      <a href={`https://roletadsaude.lovable.app/${c.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#9B8FAE', fontFamily: 'monospace', textDecoration: 'none' }} className="hover:underline">
                        roletadsaude.lovable.app/{c.slug}
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3" style={{ fontSize: 16, color: '#5A5A7A' }}>{c.campaign_type}</td>
                <td className="px-4 py-3" style={{ fontSize: 16, color: '#5A5A7A' }}>
                  {new Date(c.start_date).toLocaleDateString('pt-BR')} — {new Date(c.end_date).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-center" style={{ fontSize: 16, color: '#1A1A2E' }}>{participantCounts[c.id] || 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} className="data-[state=checked]:bg-[#22C55E] data-[state=unchecked]:bg-[#E8E0EE]" />
                    <span style={statusBadgeStyles[getStatus(c)]}>
                      {getStatus(c) === 'active' && <><Zap size={10} /> Ativa</>}
                      {getStatus(c) === 'paused' && <><PauseCircle size={10} /> Pausada</>}
                      {getStatus(c) === 'draft' && <><FileEdit size={10} /> Rascunho</>}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => onEdit(c.id)} className="transition-all hover:opacity-80"
                          style={{ background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                          <Pencil size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Editar campanha</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => onDuplicate(c.id)} className="transition-all hover:opacity-80"
                          style={{ background: '#FFFFFF', color: '#5A5A7A', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                          <Copy size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Duplicar campanha</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => setDeleteTarget(c)} className="transition-all hover:opacity-80"
                          style={{ background: '#FFFFFF', color: '#EF4444', border: '1.5px solid #E8E0EE', borderRadius: 50, padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir campanha</TooltipContent>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );


  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />)}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', ...FONT }}>Minhas Campanhas</h2>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9B8FAE' }} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar por nome ou tipo..."
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#E8357A')}
              onBlur={e => (e.target.style.borderColor = '#E8E0EE')}
            />
          </div>
          <div className="flex gap-2">
            <button style={pillStyle(statusFilter === 'all')} onClick={() => { setStatusFilter('all'); setPage(0); }}>Todas</button>
            <button style={pillStyle(statusFilter === 'active')} onClick={() => { setStatusFilter('active'); setPage(0); }}>Ativas</button>
            <button style={pillStyle(statusFilter === 'paused')} onClick={() => { setStatusFilter('paused'); setPage(0); }}>Pausadas</button>
            <button style={pillStyle(statusFilter === 'draft')} onClick={() => { setStatusFilter('draft'); setPage(0); }}>Rascunhos</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center" style={{ background: '#FFFFFF', borderRadius: 20, border: '0.5px solid #E8E0EE' }}>
            <p><Emoji emoji="📢" label="" size={32} /></p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginTop: 8, ...FONT }}>
              {campaigns.length === 0 ? 'Nenhuma campanha criada' : 'Nenhuma campanha encontrada'}
            </p>
            <p style={{ fontSize: 16, color: '#5A5A7A', marginTop: 4, ...FONT }}>
              {campaigns.length === 0 ? 'Crie sua primeira campanha clicando no botão acima' : 'Tente ajustar a busca ou os filtros'}
            </p>
          </div>
        ) : (
          <>
            {(() => {
              const officialPaged = paged.filter(c => !(c as any).is_test);
              const testPaged = paged.filter(c => (c as any).is_test);

              const SectionHeader = ({ kind, count }: { kind: 'official' | 'test'; count: number }) => (
                <div
                  className="flex items-center gap-2"
                  style={{
                    ...FONT,
                    padding: '10px 4px',
                    borderBottom: '1px solid #E8E0EE',
                    marginTop: 4,
                  }}
                >
                  {kind === 'official' ? (
                    <Rocket size={14} style={{ color: '#E8357A' }} />
                  ) : (
                    <FlaskConical size={14} style={{ color: '#B45309' }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: kind === 'official' ? '#1A1A2E' : '#92400E', letterSpacing: 0.3, textTransform: 'uppercase' }}>
                    {kind === 'official' ? 'Campanhas oficiais' : 'Campanhas de teste'}
                  </span>
                  <span style={{ fontSize: 12, color: '#9B8FAE' }}>({count})</span>
                </div>
              );

              return isMobile ? (
                /* ── Mobile: Card layout ── */
                <div className="space-y-4">
                  {officialPaged.length > 0 && (
                    <div className="space-y-3">
                      <SectionHeader kind="official" count={officialPaged.length} />
                      {officialPaged.map(c => renderMobileCard(c))}
                    </div>
                  )}
                  {testPaged.length > 0 && (
                    <div className="space-y-3">
                      <SectionHeader kind="test" count={testPaged.length} />
                      {testPaged.map(c => renderMobileCard(c))}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Desktop: Table layout, grouped ── */
                <div className="space-y-4">
                  {officialPaged.length > 0 && (
                    <div>
                      <SectionHeader kind="official" count={officialPaged.length} />
                      <div style={{ background: '#FFFFFF', borderRadius: 20, border: '0.5px solid #E8E0EE', overflow: 'hidden', marginTop: 8 }}>
                        {renderDesktopTable(officialPaged)}
                      </div>
                    </div>
                  )}
                  {testPaged.length > 0 && (
                    <div>
                      <SectionHeader kind="test" count={testPaged.length} />
                      <div
                        style={{
                          background: '#FFFBEB',
                          borderRadius: 20,
                          border: '1.5px dashed #F59E0B',
                          overflow: 'hidden',
                          marginTop: 8,
                        }}
                      >
                        {renderDesktopTable(testPaged)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}



            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3" style={FONT}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="flex items-center gap-1 transition-all hover:opacity-80"
                  style={{
                    background: '#FFFFFF', border: '1.5px solid #E8E0EE', borderRadius: 50,
                    padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
                    color: currentPage === 0 ? '#E8E0EE' : '#5A5A7A', ...FONT,
                  }}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span style={{ fontSize: 13, color: '#9B8FAE' }}>
                  Página {currentPage + 1} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="flex items-center gap-1 transition-all hover:opacity-80"
                  style={{
                    background: '#FFFFFF', border: '1.5px solid #E8E0EE', borderRadius: 50,
                    padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    color: currentPage >= totalPages - 1 ? '#E8E0EE' : '#5A5A7A', ...FONT,
                  }}
                >
                  Próximo <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent style={{ borderRadius: 20, fontFamily: 'Nunito, sans-serif' }}>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir campanha</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a campanha <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel style={{ borderRadius: 50 }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} style={{ borderRadius: 50, background: '#E8357A' }}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};

export default CampaignList;
