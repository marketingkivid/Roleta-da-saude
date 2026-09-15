import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogOut, Trophy, Megaphone, PlusCircle, Menu, X, Plus, KeyRound, Mail } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import KividLogo from '@/assets/kivid-logo.svg';
import { FONT } from '@/lib/admin-styles';
import AuthScreen from '@/components/admin/AuthScreen';
import { isRecoveryPending } from '@/lib/admin-recovery';

const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard'));
const CampaignList = lazy(() => import('@/components/admin/CampaignList'));
const CampaignModal = lazy(() => import('@/components/admin/CampaignModal'));
const ChangePasswordModal = lazy(() => import('@/components/admin/ChangePasswordModal'));
const EmailSettings = lazy(() => import('@/components/admin/EmailSettings'));

type AdminTab = 'dashboard' | 'campaigns' | 'personalizacao';

const TabFallback = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-20 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />
    ))}
  </div>
);

const Admin = () => {
  const isMobile = useIsMobile();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [userEmail, setUserEmail] = useState('');
  // Inicia true se a última recuperação ficou pela metade: impede que o dashboard
  // pisque com a sessão do verifyOtp antes do AuthScreen encerrá-la.
  const [recoveryActive, setRecoveryActive] = useState(isRecoveryPending);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignListKey, setCampaignListKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session) {
          setIsAuthenticated(true);
          setUserEmail(session.user.email ?? '');
          const { data } = await supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' });
          if (mounted) setIsAdmin(!!data);
        }
      } catch (e) {
        console.error('Auth init error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email ?? '');
      if (session) {
        supabase.rpc('has_role', { _user_id: session.user.id, _role: 'admin' }).then(({ data }) => {
          if (mounted) setIsAdmin(!!data);
        });
      } else {
        setIsAdmin(false);
        // Sem isso o modal reabriria sozinho no próximo login.
        setShowChangePassword(false);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  const openCreate = () => { setEditingCampaignId(null); setShowModal(true); setSidebarOpen(false); };
  const openEdit = (id: string) => { setEditingCampaignId(id); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingCampaignId(null); };
  const onSaved = () => { closeModal(); setCampaignListKey(k => k + 1); };

  const handleDuplicate = async (id: string) => {
    try {
      const { data: original, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchError || !original) { toast.error('Erro ao buscar campanha'); return; }

      // Generate unique slug
      let baseSlug = original.slug + '-copia';
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const { data: existing } = await supabase.from('campaigns').select('id').eq('slug', slug).maybeSingle();
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const { id: _id, created_at: _ca, ...campaignData } = original;
      const { data: newCampaign, error: insertError } = await supabase
        .from('campaigns')
        .insert({ ...campaignData, name: original.name + ' (cópia)', slug })
        .select()
        .single();
      if (insertError || !newCampaign) { toast.error('Erro ao duplicar campanha'); return; }

      // Copy prizes
      const { data: prizes } = await supabase.from('prizes').select('*').eq('campaign_id', id);
      if (prizes && prizes.length > 0) {
        const newPrizes = prizes.map(({ id: _pid, created_at: _pca, quantity_distributed: _qd, ...rest }) => ({
          ...rest,
          campaign_id: newCampaign.id,
          quantity_distributed: 0,
        }));
        await supabase.from('prizes').insert(newPrizes);
      }

      toast.success('Campanha duplicada!');
      setCampaignListKey(k => k + 1);
      setEditingCampaignId(newCampaign.id);
      setShowModal(true);
    } catch {
      toast.error('Erro ao duplicar campanha');
    }
  };

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'AD';

  const navItems = [
    { key: 'dashboard' as AdminTab, label: 'Dashboard', icon: Trophy },
    { key: 'campaigns' as AdminTab, label: 'Minhas Campanhas', icon: Megaphone },
    { key: 'personalizacao' as AdminTab, label: 'Personalização', icon: Mail },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f9f9', ...FONT }}>
        <div className="space-y-4 w-64">
          <div className="h-8 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />
          <div className="h-4 rounded-[20px] w-3/4 animate-pulse" style={{ background: '#E8E0EE' }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin || recoveryActive) {
    return (
      <AuthScreen
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        onRecoveryActiveChange={setRecoveryActive}
      />
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ ...FONT }}>
      <div style={{ padding: '24px 20px 20px' }}>
        <img src={KividLogo} alt="Kivid" className="h-8" />
        <p style={{ fontSize: 11, color: '#9B8FAE', marginTop: 4 }}>Backoffice</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => {
          const active = activeTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key); if (isMobile) setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 transition-all"
              style={{
                padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: active ? '#FDF0F5' : 'transparent',
                color: active ? '#E8357A' : '#5A5A7A',
                fontWeight: active ? 700 : 400, fontSize: 14, ...FONT,
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              {item.label}
            </button>
          );
        })}

        <div style={{ paddingTop: 12 }}>
          <button
            onClick={openCreate}
            className="w-full flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: '#E8357A', color: '#fff', borderRadius: 50, padding: '12px 20px',
              fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', ...FONT,
            }}
          >
            <PlusCircle size={16} /> Nova campanha
          </button>
        </div>
      </nav>

      <div style={{ padding: '16px 16px 20px', borderTop: '1px solid #E8E0EE' }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#FDF0F5',
            border: '1.5px solid #E8E0EE', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#E8357A', fontSize: 12, flexShrink: 0, ...FONT,
          }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontSize: 13, color: '#5A5A7A', ...FONT }}>{userEmail}</p>
          </div>
          <button
            onClick={() => { setShowChangePassword(true); setSidebarOpen(false); }}
            title="Alterar senha"
            aria-label="Alterar senha"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', flexShrink: 0 }}
          >
            <KeyRound size={16} />
          </button>
          <button onClick={handleLogout} title="Sair" aria-label="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE', flexShrink: 0 }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9f9', ...FONT }}>
      {!isMobile && (
        <aside className="shrink-0 h-screen sticky top-0" style={{ width: 240, background: '#FFFFFF', borderRight: '1px solid #E8E0EE' }}>
          <SidebarContent />
        </aside>
      )}

      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setSidebarOpen(false)} />
          <aside className="relative h-full" style={{ width: 260, background: '#FFFFFF', boxShadow: '4px 0 20px rgba(0,0,0,0.1)' }}>
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8FAE' }}>
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {isMobile && (
          <header className="shrink-0 flex items-center justify-between" style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E0EE', padding: '12px 16px' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A5A7A' }}>
              <Menu size={22} />
            </button>
            <img src={KividLogo} alt="Kivid" className="h-7" />
            <div style={{ width: 22 }} />
          </header>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-10">
          <Suspense fallback={<TabFallback />}>
            {activeTab === 'dashboard' && <AdminDashboard />}
            {activeTab === 'campaigns' && <CampaignList key={campaignListKey} onEdit={openEdit} onDuplicate={handleDuplicate} />}
            {activeTab === 'personalizacao' && <EmailSettings />}
          </Suspense>
        </main>
      </div>

      {/* FAB mobile */}
      {isMobile && !showModal && (
        <button
          onClick={openCreate}
          className="fixed z-40 flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
          style={{
            bottom: 24, right: 20, width: 56, height: 56, borderRadius: '50%',
            background: '#E8357A', color: '#FFFFFF', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(232, 53, 122, 0.35)',
          }}
          aria-label="Nova campanha"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {showModal && (
        <Suspense fallback={null}>
          <CampaignModal
            campaignId={editingCampaignId}
            onClose={closeModal}
            onSaved={onSaved}
          />
        </Suspense>
      )}

      {showChangePassword && (
        <Suspense fallback={null}>
          <ChangePasswordModal email={userEmail} onClose={() => setShowChangePassword(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default Admin;
