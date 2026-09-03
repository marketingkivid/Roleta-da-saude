import kividLogoFooter from "@/assets/kivid-logo-footer.svg";

const Footer = () => (
  <footer className="w-full bg-foreground py-6 px-6 mt-auto">
    <div className="max-w-4xl mx-auto flex flex-col items-center gap-3 md:flex-row md:justify-between">
      <img src={kividLogoFooter} alt="Kivid" className="w-24" />
      <p className="text-primary-foreground text-sm font-light">
        Seu <span className="font-bold">Passaporte</span> de Saúde
      </p>
    </div>
  </footer>
);

export default Footer;
