-- Create unified transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('expense','income','savings','loan','transfer')),
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'KES',
  category text NOT NULL,
  merchant text,
  description text,
  raw_text text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai_text','sms','receipt','manual')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  spent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX transactions_user_spent_at_idx ON public.transactions (user_id, spent_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing expenses
INSERT INTO public.transactions (user_id, type, amount, currency, category, description, raw_text, source, spent_at, created_at)
SELECT user_id, 'expense', amount, currency, category, description, raw_text, 'ai_text', spent_at, created_at
FROM public.expenses;

DROP TABLE public.expenses;