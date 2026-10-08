ALTER TABLE iup_quarterly_plans
  DROP CONSTRAINT IF EXISTS iup_quarterly_plans_start_month_check,
  DROP CONSTRAINT IF EXISTS iup_quarterly_plans_end_month_check,
  ADD CONSTRAINT iup_quarterly_plans_start_month_check
    CHECK (start_month BETWEEN 1 AND 12),
  ADD CONSTRAINT iup_quarterly_plans_end_month_check
    CHECK (end_month BETWEEN 1 AND 12),
  ADD CONSTRAINT iup_quarterly_plans_month_range_check
    CHECK (start_month <= end_month);
