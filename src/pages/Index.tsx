import { lazy, Suspense } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProgressBar from '@/components/ProgressBar';
import LandingScreen from '@/screens/LandingScreen';
import { useCampaign } from '@/hooks/useCampaign';

const ValidationScreen = lazy(() => import('@/screens/ValidationScreen'));
const RouletteScreen = lazy(() => import('@/screens/RouletteScreen'));
const RewardScreen = lazy(() => import('@/screens/RewardScreen'));
const ConsolationScreen = lazy(() => import('@/screens/ConsolationScreen'));
const AlreadyPlayedScreen = lazy(() => import('@/screens/AlreadyPlayedScreen'));

const ScreenFallback = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Carregando"
    className="flex-1 flex items-center justify-center"
  >
    <div className="animate-pulse h-40 w-40 rounded-full" style={{ background: '#E8E0EE' }} aria-hidden="true" />
    <span className="sr-only">Carregando…</span>
  </div>
);


const Index = () => {
  const { slug } = useParams<{ slug?: string }>();

  const {
    step,
    participantData,
    prize,
    termsAccepted,
    lgpdAccepted,
    setTermsAccepted,
    setLgpdAccepted,
    goToValidation,
    submitValidation,
    resetCampaign,
    hasParticipantList,
    validationError,
    prefillData,
    campaignId,
    spinRoulette,
    finalizeRouletteWin,
    closeRouletteModal,
  } = useCampaign(slug);

  // Loading state
  if (step === 'loading') {
    return (
      <main
        role="status"
        aria-live="polite"
        aria-label="Carregando campanha"
        className="min-h-dvh flex items-center justify-center"
        style={{ background: '#F5F3F7' }}
      >
        <div className="space-y-4 w-64" aria-hidden="true">
          <div className="h-8 rounded-[20px] animate-pulse" style={{ background: '#E8E0EE' }} />
          <div className="h-4 rounded-[20px] w-3/4 animate-pulse" style={{ background: '#E8E0EE' }} />
        </div>
        <span className="sr-only">Carregando campanha…</span>
      </main>
    );
  }

  // Shared responsive info card wrapper for status/error screens
  const infoMainStyle: React.CSSProperties = {
    background: '#F5F3F7',
    paddingLeft: 'max(16px, env(safe-area-inset-left))',
    paddingRight: 'max(16px, env(safe-area-inset-right))',
    paddingTop: 'max(16px, env(safe-area-inset-top))',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
  };
  const infoCardClass = 'w-full max-w-[400px] sm:max-w-md mx-auto text-center';
  const infoCardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E8E0EE',
    borderRadius: 20,
    padding: 'clamp(24px, 6vw, 40px) clamp(20px, 5vw, 32px)',
  };
  const infoCtaStyle: React.CSSProperties = {
    display: 'inline-block',
    background: '#E8357A',
    color: '#FFFFFF',
    borderRadius: 50,
    padding: '14px 28px',
    fontWeight: 700,
    fontSize: 16,
    textDecoration: 'none',
  };

  // No campaign (direct access to /)
  if (step === 'no_campaign') {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={infoMainStyle}>
        <div className={infoCardClass} style={infoCardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🎯</div>
          <h1 className="text-lg sm:text-xl font-bold mb-2" style={{ color: '#1A1A2E' }}>Acesse pelo link da campanha</h1>
          <p className="text-sm sm:text-base" style={{ color: '#9B8FAE' }}>Nossas campanhas funcionam através de links exclusivos. Acesse pelo link que você recebeu.</p>
        </div>
      </main>
    );
  }

  // Campaign not found
  if (step === 'not_found') {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={infoMainStyle}>
        <div className={infoCardClass} style={infoCardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🔍</div>
          <h1 className="text-lg sm:text-xl font-bold mb-2" style={{ color: '#1A1A2E' }}>Campanha não encontrada</h1>
          <p className="text-sm sm:text-base mb-6" style={{ color: '#9B8FAE' }}>O link que você acessou não corresponde a nenhuma campanha ativa.</p>
          <Link to="/" style={infoCtaStyle}>Voltar ao início</Link>
        </div>
      </main>
    );
  }

  // Campaign inactive
  if (step === 'inactive') {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={infoMainStyle}>
        <div className={infoCardClass} style={infoCardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">⏸️</div>
          <h1 className="text-lg sm:text-xl font-bold mb-2 text-balance" style={{ color: '#1A1A2E' }}>Esta campanha ainda não está disponível</h1>
          <p className="text-sm sm:text-base mb-6" style={{ color: '#9B8FAE' }}>A campanha pode ter sido encerrada ou ainda não foi ativada.</p>
          <Link to="/" style={infoCtaStyle}>Voltar ao início</Link>
        </div>
      </main>
    );
  }

  // Token required (list campaign accessed without token)
  if (step === 'token_required') {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={infoMainStyle}>
        <div className={infoCardClass} style={infoCardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🔒</div>
          <h1 className="text-lg sm:text-xl font-bold mb-2" style={{ color: '#1A1A2E' }}>Acesso exclusivo</h1>
          <p className="text-sm sm:text-base" style={{ color: '#9B8FAE' }}>Esta campanha é exclusiva para convidados. Acesse pelo link enviado para você.</p>
        </div>
      </main>
    );
  }

  // Token error (invalid or expired token)
  if (step === 'token_error') {
    return (
      <main className="min-h-dvh flex items-center justify-center" style={infoMainStyle}>
        <div className={infoCardClass} style={infoCardStyle}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">⚠️</div>
          <h1 className="text-lg sm:text-xl font-bold mb-2" style={{ color: '#1A1A2E' }}>Link inválido</h1>
          <p className="text-sm sm:text-base" style={{ color: '#9B8FAE' }}>Este link é inválido ou já expirou. Verifique o link enviado para você.</p>
        </div>
      </main>
    );
  }


  const isLanding = step === 'landing';
  const isGame = step === 'game';
  const showProgress = step === 'validation' || step === 'game' || step === 'reward' || step === 'consolation';

  return (
    <div className={`bg-background flex flex-col ${isGame ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>
      <Header show={!isLanding} />
      {showProgress && (
        <ProgressBar currentStep={step as 'validation' | 'game' | 'reward'} />
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 flex flex-col focus:outline-none ${
          isGame
            ? 'min-h-0 overflow-hidden pb-0'
            : step === 'validation'
              ? 'justify-start min-h-0 overflow-y-auto overscroll-contain pb-0'
              : 'justify-center pb-8'
        }`}
        style={
          step === 'validation'
            ? { WebkitOverflowScrolling: 'touch', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }
            : undefined
        }
      >

        {isLanding && <LandingScreen onStart={goToValidation} />}
        <Suspense fallback={<ScreenFallback />}>
          {step === 'validation' && (
            <>
              {prize && (
                <div className="max-w-md mx-auto w-full px-4 sm:px-8 pt-2 shrink-0">
                  <div
                    role="status"
                    aria-live="polite"
                    className="rounded-2xl p-3 sm:p-4 flex items-center gap-3 animate-fade-in bg-muted border border-primary/30"
                  >
                    <div className="text-3xl sm:text-4xl shrink-0" aria-hidden="true">{prize.emoji || '🎁'}</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">
                        Você ganhou
                      </p>
                      <p className="text-base sm:text-lg font-black text-foreground leading-tight break-words">{prize.name}</p>
                    </div>
                  </div>
                </div>
              )}
              <ValidationScreen
                termsAccepted={termsAccepted}
                lgpdAccepted={lgpdAccepted}
                setTermsAccepted={setTermsAccepted}
                setLgpdAccepted={setLgpdAccepted}
                onSubmit={submitValidation}
                hasParticipantList={hasParticipantList}
                validationError={validationError}
                prefillData={prefillData ?? undefined}
                postWin={!!prize}
              />
            </>
          )}
          {step === 'game' && campaignId && (
            <RouletteScreen
              campaignId={campaignId}
              onSpin={spinRoulette}
              onFinish={finalizeRouletteWin}
              onClose={closeRouletteModal}
            />
          )}
          {step === 'reward' && prize && (
            <RewardScreen prize={prize} participantName={participantData.name} onReset={resetCampaign} />
          )}
          {step === 'consolation' && prize && (
            <ConsolationScreen prize={prize} participantName={participantData.name} onReset={resetCampaign} />
          )}
          {step === 'already_played' && <AlreadyPlayedScreen onReset={resetCampaign} />}
        </Suspense>
      </main>

      {isLanding && <Footer />}
    </div>
  );
};


export default Index;
