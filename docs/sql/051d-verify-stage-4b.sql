-- ==========================================================================
-- Stage 4b -- verification, run AFTER 051a, 051b and 051c
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- Read-only. No RAISE, no DO block, no temp table, nothing written.
--
-- ⚠️ ONE QUERY ON PURPOSE. The Supabase SQL editor shows the result of the
-- LAST statement only, so a script of several selects quietly hides all but
-- one of its own answers. Everything below is a single row.
--
-- ⚠️ AND IT RE-MEASURES RATHER THAN TRUSTING the three scripts above. 050d was
-- read and not executed, and only a check reading the function's CONTENT
-- caught it -- one counting its existence would have said "present" and passed.
-- Every column here reads the database, not this repository.
--
-- EXPECTED (all of them, or the round is not finished):
--   col_type_expect_numeric        numeric
--   col_nullable_expect_YES        YES
--   check_non_negative             CHECK ((bonus_quantity IS NULL) OR ...)
--   check_within_entered           CHECK ((bonus_quantity IS NULL) OR ...)
--   forbidden_check_expect_0       0
--   comment_is_arabic_expect_t     t
--   post_copies_expect_1           1
--   post_insert_names_col_expect_t t
--   post_stores_value_expect_t     t
--   post_reads_entered_once_t      t
--   post_guards_expect_3           3
--   rev_copies_expect_1            1
--   rev_copies_bonus_expect_1      1
--   rev_negated_columns_expect_1   1
--   raises_expect_21               21
--   distinct_codes_expect_14       14
--   code_map                       the fourteen names, alphabetical
--   rows_with_bonus_expect_0       0
-- ==========================================================================

with codes as (
  select m[1] as code
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral regexp_matches(p.prosrc, 'raise exception ''([a-z_]+)''', 'g') m
  where n.nspname = 'public'
    and p.proname in ('post_stock_document', 'post_stocktake',
                      'transfer_stock', 'reverse_stock_document')
),
post as (
  select p.prosrc, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'post_stock_document'
),
rev as (
  select p.prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'reverse_stock_document'
)
select
  -- ── 051a: the column ────────────────────────────────────────────────────
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements'
      and column_name = 'bonus_quantity')                     as col_type_expect_numeric,
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements'
      and column_name = 'bonus_quantity')                     as col_nullable_expect_YES,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_bonus_non_negative')     as check_non_negative,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_bonus_within_entered')   as check_within_entered,

  -- ⚠️ THE ASSERTION ABOUT AN ABSENCE, and the only one here that guards a
  -- future edit rather than this one. `check (bonus_quantity is null or
  -- quantity_base > 0)` looks obviously right and would refuse every reversal
  -- of a bonus supply, because 051c copies a positive bonus onto a negated
  -- quantity. Nothing else in this file would notice it being added.
  (select count(*) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and pg_get_constraintdef(oid) like '%bonus_quantity%'
      and pg_get_constraintdef(oid) like '%quantity_base%')   as forbidden_check_expect_0,

  -- The comment is read back from the database and asked whether it is Arabic,
  -- not merely whether it is present. 048 measured eighteen hints that were
  -- present, in English, and looked entirely healthy from any count.
  (select col_description('public.stock_movements'::regclass,
     (select ordinal_position from information_schema.columns
       where table_schema = 'public' and table_name = 'stock_movements'
         and column_name = 'bonus_quantity')::int) ~ '[ء-ي]') as comment_is_arabic_expect_t,

  -- ── 051b: the function stores it and guards it ──────────────────────────
  (select count(*) from post)                                 as post_copies_expect_1,
  (select prosrc like '%bonus_quantity)%' from post)          as post_insert_names_col_expect_t,
  (select prosrc like '%v_bonus)%' from post)                 as post_stores_value_expect_t,
  (select prosrc like '%v_entered,%' from post)               as post_reads_entered_once_t,
  -- All three refusals, counted rather than sampled: one of them present is
  -- not the rule being enforced.
  (select (prosrc like '%bonus_supply_only%')::int
        + (prosrc like '%bonus_negative%')::int
        + (prosrc like '%bonus_over_quantity%')::int from post) as post_guards_expect_3,
  (select prosecdef from post)                                as post_secdef_expect_f,
  (select proconfig is null from post)                        as post_search_path_unset_t,

  -- ── 051c: the reversal inherits it ──────────────────────────────────────
  (select count(*) from rev)                                  as rev_copies_expect_1,
  (select (length(prosrc) - length(replace(prosrc, 'm.bonus_quantity', '')))
          / length('m.bonus_quantity') from rev)              as rev_copies_bonus_expect_1,
  (select (length(prosrc) - length(replace(prosrc, '-m.', '')))
          / length('-m.') from rev)                           as rev_negated_columns_expect_1,

  -- ── the refusal map, which this round grew from 11 names to 14 ──────────
  (select count(*) from codes)                                as raises_expect_21,
  (select count(distinct code) from codes)                    as distinct_codes_expect_14,
  (select string_agg(distinct code, ', ' order by code) from codes) as code_map,

  -- ── and nothing was claimed about history ───────────────────────────────
  -- The column is nullable with no DEFAULT, so no existing movement was told
  -- anything about a bonus nobody measured. Zero until a screen writes one.
  (select count(*) from public.stock_movements
    where bonus_quantity is not null)                         as rows_with_bonus_expect_0;
