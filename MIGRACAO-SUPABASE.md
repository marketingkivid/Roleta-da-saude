# Migração para o novo projeto Supabase

Projeto novo: **`pzhrjsgujoytmxowkgca`**
URL: `https://pzhrjsgujoytmxowkgca.supabase.co`

O `supabase/config.toml` já aponta para o projeto novo. Falta o resto abaixo.
Tudo isto precisa das suas credenciais do Supabase — **eu não executo** (regra
de segurança: não uso senhas/chaves). Comandos rodam na pasta `Roleta da saúde`.

---

## 1. Login e link

```bash
npx supabase login
npx supabase link --project-ref pzhrjsgujoytmxowkgca
```

## 2. Recriar o banco (tabelas, RLS, funções)

As 34 migrações em `supabase/migrations/` recriam tudo (7 tabelas:
campaigns, prizes, participations, campaign_participants, campaign_spins,
leads, user_roles + todas as funções RPC + políticas RLS).

```bash
npx supabase db push
```

## 3. Deploy das edge functions

```bash
npx supabase functions deploy spin-roulette
npx supabase functions deploy sync-lead-brevo
npx supabase functions deploy fix-brevo-errors
npx supabase functions deploy create-admin-user
npx supabase functions deploy public-dashboard
```

## 4. Secrets das edge functions

Em **Supabase → Project Settings → Edge Functions → Secrets** (ou
`npx supabase secrets set NOME=valor`):

| Secret | Para que serve | De onde vem |
|---|---|---|
| `PANEL_ACCESS_CODE` | código do painel "só resultados" em /admin | você inventa (forte) |
| `BREVO_API_KEY` | sincronizar leads com o Brevo | sua conta Brevo → SMTP & API |
| `BREVO_LIST_ID` | lista do Brevo que recebe os leads | Brevo → Contacts → Lists |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente
pelo Supabase — não precisa configurar.

## 5. Criar o usuário admin

O app checa `has_role(uid, 'admin')`. Depois de criar seu usuário no
Authentication do Supabase, insira o papel:

```sql
insert into public.user_roles (user_id, role)
values ('<uuid-do-seu-usuario>', 'admin');
```

(ou use a função `create-admin-user` se ela cobrir isso — conferir o código dela)

## 6. Atualizar o `.env` do front

Me passe a **anon key pública** do projeto novo
(Project Settings → API → Project API keys → `anon` `public`, começa com `eyJ...`)
que eu atualizo o `.env`:

```
VITE_SUPABASE_PROJECT_ID="pzhrjsgujoytmxowkgca"
VITE_SUPABASE_URL="https://pzhrjsgujoytmxowkgca.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon key>"
```

> A anon key **pode** ir no `.env`/repositório — ela é pública por design
> (o que protege os dados é a RLS). A **service_role key** nunca.

## 7. Dados

O projeto novo começa vazio. As campanhas precisam ser recriadas em `/admin`
(logado) ou importadas do projeto antigo via `pg_dump`/CSV.

---

## Checklist

- [ ] `supabase login` + `link`
- [ ] `supabase db push`
- [ ] deploy das 5 edge functions
- [ ] secrets: `PANEL_ACCESS_CODE`, `BREVO_API_KEY`, `BREVO_LIST_ID`
- [ ] usuário admin + linha em `user_roles`
- [ ] me mandar a anon key → atualizo o `.env`
- [ ] recriar campanhas
