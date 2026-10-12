ALTER TABLE public.iup_quarterly_plans
  DROP CONSTRAINT IF EXISTS iup_quarterly_plans_quarter_check,
  ADD CONSTRAINT iup_quarterly_plans_quarter_positive_check CHECK (quarter >= 1);
