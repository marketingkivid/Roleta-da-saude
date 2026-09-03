import kividLogo from '@/assets/kivid-logo.svg';

interface HeaderProps {
  show?: boolean;
}

const Header = ({ show = true }: HeaderProps) => {
  if (!show) return null;

  return (
    <header className="w-full py-4 px-6 flex items-center justify-center">
      <div className="text-center flex flex-col items-center gap-1">
        <img src={kividLogo} alt="Kivid" className="w-24" />
        <p className="text-xs text-muted-foreground font-light">Seu Passaporte de Saúde</p>
      </div>
    </header>
  );
};

export default Header;
