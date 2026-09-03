ALTER TABLE public.prizes ADD COLUMN is_consolation boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX one_active_consolation ON public.prizes (is_consolation) WHERE is_consolation = true AND active = true;