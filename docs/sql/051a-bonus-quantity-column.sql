-- ==========================================================================
-- Stage 4b -- bonus_quantity: the free goods, stored so a row can explain its
--             own cost
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No RAISE is executed here, no DO block, no temp table -- so nothing can put
-- this script in a transaction that rolls its own DDL back.
--
-- RUN ORDER: 051a -> 051b -> 051c -> 051d.
--
-- ---------------------------------------------------------------------------
-- WHY A COLUMN AT ALL, when the arithmetic does not need one
--
-- Six are paid for, seven arrive, and 300/7 lands on each. The division
-- happens in lib/documentMoney.js and the function is handed a unit_cost that
-- is already landed -- exactly as it has been since stage 4. So the database
-- never divides by this number.
--
-- It is stored because WITHOUT IT THE ROW CANNOT EXPLAIN ITSELF. A movement
-- reading "7 pieces at 42.857" beside an invoice reading 50 has a gap in it,
-- and the only thing that closes the gap is the bonus. At bonus = quantity the
-- cost is 0, which is indistinguishable -- from the row alone -- from the
-- poisoning fault this module spent rounds killing (a blank box arriving as
-- Number('') === 0 and being stamped for good). This column is what tells a
-- legitimate zero apart from that one.
--
-- ---------------------------------------------------------------------------
-- THE CONSTRAINT THAT IS DELIBERATELY ABSENT
--
-- "A bonus belongs to a receipt" is a real rule, and it is NOT a CHECK here.
-- The obvious form -- check (bonus_quantity is null or quantity_base > 0) --
-- would reject every reversal of a bonus supply: reverse_stock_document
-- negates quantity_base while copying entered_quantity and (from 051c)
-- bonus_quantity across unchanged, so the reversing row is a NEGATIVE quantity
-- legitimately carrying a positive bonus.
--
-- And it cannot be written correctly either, because doc_type lives on
-- stock_documents and a CHECK cannot see another table. So the rule lives in
-- post_stock_document (051b, code bonus_supply_only) and on the screen, and
-- 051d asserts that no CHECK mentioning bonus_quantity ever mentions
-- quantity_base -- an assertion about a constraint's ABSENCE, because the
-- helpful future addition of it is the thing that would break reversals.
-- ==========================================================================

alter table public.stock_movements
  add column if not exists bonus_quantity numeric;

-- Idempotent: a constraint has no ADD ... IF NOT EXISTS, so drop first.
alter table public.stock_movements
  drop constraint if exists stock_movements_bonus_non_negative;
alter table public.stock_movements
  add constraint stock_movements_bonus_non_negative
  check (bonus_quantity is null or bonus_quantity >= 0);

-- ⚠️ THIS ONE PROTECTS THE DIVISOR, not the tidiness of the row. The money a
-- line contributes is (entered - bonus) * price, and that is the WEIGHT the
-- document discount and the freight are split by. A bonus larger than the
-- quantity makes one weight negative, which makes shares exceed one or flip
-- sign for EVERY line in the document -- not only for its own.
--
-- abs() because entered_quantity is stored positive on issues too (the sign is
-- the document's and lives in quantity_base), and defensively so in case that
-- ever stops being true.
alter table public.stock_movements
  drop constraint if exists stock_movements_bonus_within_entered;
alter table public.stock_movements
  add constraint stock_movements_bonus_within_entered
  check (bonus_quantity is null
         or (entered_quantity is not null
             and bonus_quantity <= abs(entered_quantity)));

comment on column public.stock_movements.bonus_quantity is
  'الكمّيةُ المجّانيّة ضمن هذا السطر، بوحدة entered_uom نفسها وجزءًا من entered_quantity لا زيادةً عليها: سبعٌ وصلت وواحدةٌ مجّانًا تُكتب entered_quantity=7 و bonus_quantity=1، والمدفوع عنه ستّ. ⚠️ و quantity_base يشمل المجّانيّة كاملةً لأنها دخلت المخزون فعلًا — ومن يجعله الكمّيةَ المدفوعة يُنقص المخزون بمقدار البضاعة المجّانيّة بالضبط. والمال يضرب في المدفوع عنه (7−1) بينما الكلفة تقسم على المستلَم (7)، فـ unit_cost هنا ٤٢٫٨٥٧ لا ٥٠ ولا صفر. مخزَّنٌ للقراءة لا للحساب: التوزيع يجري قبل النداء، وبلا هذا العمود تعجز الحركةُ عن تفسير كلفتها، وعند بونصٍ يساوي الكمّية تصير الكلفةُ صفرًا لا يُميَّز عن خانةٍ فارغة وصلت صفرًا. يُسجَّل بالتوريد والافتتاح وحدهما، وينسخه العكسُ كما هو.';

-- ---------------------------------------------------------------------------
-- Verification. One row. Every Arabic character deposited above is read back
-- here, in the same script, because what is shipped to a place we cannot see
-- is read back from it.
-- ---------------------------------------------------------------------------
select
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements'
      and column_name = 'bonus_quantity')                    as type_expect_numeric,

  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_movements'
      and column_name = 'bonus_quantity')                    as nullable_expect_YES,

  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_bonus_non_negative')    as check_non_negative,

  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_bonus_within_entered')  as check_within_entered,

  -- ⚠️ Expected 0. The CHECK that must never exist: see the header.
  (select count(*) from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and pg_get_constraintdef(oid) like '%bonus_quantity%'
      and pg_get_constraintdef(oid) like '%quantity_base%')  as forbidden_check_expect_0,

  -- The comment, read back from the database rather than trusted from above.
  col_description('public.stock_movements'::regclass,
    (select ordinal_position from information_schema.columns
      where table_schema = 'public' and table_name = 'stock_movements'
        and column_name = 'bonus_quantity')::int)            as comment_read_back,

  -- Existing rows are untouched: the column is nullable with no DEFAULT, so
  -- nothing is claimed about any movement written before today. (A DEFAULT
  -- would have written a statement about history that nobody measured -- the
  -- lesson from cost_is_estimated in 043.)
  (select count(*) from public.stock_movements
    where bonus_quantity is not null)                        as rows_with_bonus_expect_0;
