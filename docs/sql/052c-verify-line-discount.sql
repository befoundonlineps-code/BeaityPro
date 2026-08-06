-- ==========================================================================
-- 052c -- VERIFICATION ONLY. Read-only. Run AFTER 052b.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- One query, because the SQL editor shows the result of the last statement
-- only — a file of several selects hides all but one of its own answers.
--
-- ⚠️ AND IT IS A SEPARATE PASTE, which is the whole reason this file exists as
-- a file. However wrong anything below turns out to be, its failure can undo
-- nothing: 052b's transaction closed before this one opened.
--
-- EXPECTED:
--   constraint_definition        CHECK (((line_discount_value IS NULL) OR ...))
--   is_validated_expect_t        t      (existing rows were checked, not skipped)
--   violating_rows_expect_0      0
--   discount_kind_check_kept     the 050b constraint, still there
--   line_money_nonneg_kept       the 050b constraint, still there
--   bonus_checks_kept_expect_2   2      (the two from 051a)
-- ==========================================================================

select
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_line_discount_within_line_check')
                                                          as constraint_definition,

  -- ⚠️ NOT convalidated being merely present. A constraint added NOT VALID
  -- exists, reports its definition, and has never looked at a single existing
  -- row — so reading the definition alone would say "protected" about a table
  -- that was never checked.
  (select convalidated from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_line_discount_within_line_check')
                                                          as is_validated_expect_t,

  -- The same predicate as 052a, asked again after the fact. If the constraint
  -- is doing what it says, this cannot be anything but zero — which makes it a
  -- check that CAN fail only if the constraint was added in a form that does
  -- not mean what it reads like.
  (select count(*) from stock_movements m
    where m.line_discount_value is not null
      and not (
        (m.line_discount_kind = 'percent' and m.line_discount_value <= 100)
        or (m.line_discount_kind = 'amount'
            and m.entered_unit_price is not null
            and m.entered_quantity is not null
            and m.line_discount_value
                <= (abs(m.entered_quantity) - coalesce(m.bonus_quantity, 0)) * m.entered_unit_price)
      ))                                                  as violating_rows_expect_0,

  -- ⚠️ The neighbours are re-read because ALTER TABLE is not the only thing
  -- that has ever removed something nobody meant to remove. Naming them here
  -- costs one line each and turns "the new one is there" into "the set is what
  -- we think it is".
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_line_discount_kind_check')
                                                          as discount_kind_check_kept,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_line_money_nonneg_check')
                                                          as line_money_nonneg_kept,
  (select count(*) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname in ('stock_movements_bonus_non_negative',
                      'stock_movements_bonus_within_entered'))
                                                          as bonus_checks_kept_expect_2;
