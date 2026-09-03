import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { digitsOnly, isValidBRMobile, toE164BR } from "@/lib/phone";

const schema = z.object({
  first_name: z.string().trim().min(1, "Informe seu nome").max(80),
  last_name: z.string().trim().min(1, "Informe seu sobrenome").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
  whatsapp: z.string().refine(isValidBRMobile, "WhatsApp inválido (DDD + número)"),
});

type Form = z.infer<typeof schema>;

const Leads = () => {
  const [params] = useSearchParams();
  const campanha = useMemo(() => params.get("c") || null, [params]);
  const [form, setForm] = useState<Form>({ first_name: "", last_name: "", email: "", whatsapp: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const setField = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({
        first_name: fe.first_name?.[0],
        last_name: fe.last_name?.[0],
        email: fe.email?.[0],
        whatsapp: fe.whatsapp?.[0],
      });
      return;
    }
    setLoading(true);
    const raw = digitsOnly(parsed.data.whatsapp);
    const { data, error } = await supabase
      .from("leads")
      .insert({
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        email: parsed.data.email,
        whatsapp_raw: raw,
        whatsapp_e164: toE164BR(raw),
        origem: "site",
        campanha,
        pagina: window.location.pathname,
      })
      .select("id")
      .single();
    setLoading(false);

    if (error) {
      const msg = error.message?.includes("leads_email_unique")
        ? "Este e-mail já está cadastrado 🙂"
        : "Não foi possível cadastrar agora. Tente novamente.";
      toast({ title: msg, variant: "destructive" });
      return;
    }

    // fire-and-forget Brevo sync
    supabase.functions.invoke("sync-lead-brevo", { body: { leadId: data.id } }).catch(() => {});

    toast({ title: "Recebemos seu contato! 🎉", description: "Em breve enviaremos novidades pra você." });
    setForm({ first_name: "", last_name: "", email: "", whatsapp: "" });
    setDone(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f8f9f9" }}>
      <section className="w-full max-w-md bg-white rounded-[20px] border p-8 shadow-sm" style={{ borderColor: "#E8E0EE" }}>
        <h1 className="text-3xl font-bold mb-2">Quer ficar por dentro?</h1>
        <p className="text-muted-foreground mb-6">Deixe seus dados e te avisamos das novidades.</p>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-lg">Pronto! Já estamos com você 💜</p>
            <Button variant="outline" onClick={() => setDone(false)}>Cadastrar outro</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Nome</label>
              <input
                value={form.first_name}
                onChange={(e) => setField("first_name", e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-input bg-background outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                placeholder="Maria"
              />
              {errors.first_name && <p className="text-sm text-red-700 mt-1">{errors.first_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Sobrenome</label>
              <input
                value={form.last_name}
                onChange={(e) => setField("last_name", e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-input bg-background outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                placeholder="Silva"
              />
              {errors.last_name && <p className="text-sm text-red-700 mt-1">{errors.last_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-input bg-background outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                placeholder="maria@email.com"
              />
              {errors.email && <p className="text-sm text-red-700 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">WhatsApp</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setField("whatsapp", e.target.value)}
                className="w-full h-12 px-3 rounded-xl border border-input bg-background outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                placeholder="(11) 99999-9999"
              />
              {errors.whatsapp && <p className="text-sm text-red-700 mt-1">{errors.whatsapp}</p>}
            </div>

            <Button variant="hero" size="lg" onClick={submit} disabled={loading} className="w-full">
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              {loading ? "Enviando..." : "Quero receber"}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
};

export default Leads;
