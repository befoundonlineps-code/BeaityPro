-- ==========================================================================
-- 080 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ THIS PRECEDES THE CATALOGUE SCREEN. Both fields below came out of 079b_1
-- unasked, and one of them has already produced an invented value once.
--
-- ---------------------------------------------------------------------------
-- 🔴 accounting_direction — text, nullable, NO enum and NO constraint.
--
-- It is the only field on products with an OPEN domain, and it is the exact
-- field a design tool filled with a value nobody defined («مبيعات الصالون»).
-- That is not a coincidence worth shrugging at: every other field refused an
-- invented value because its type or its CHECK refused it, and this one had
-- nothing to refuse with.
--
-- ⚠️ AND THE SCREEN BEING BUILT WRITES THIS FIELD. A dropdown over an open
-- text column produces the whole class of fault this module has paid for: two
-- spellings of one meaning, a value from an old build that no longer appears
-- in any list, and a report that groups by it and quietly splits a total.
--
-- ⇒ It gets an enum or a CHECK before a screen writes it. That script cannot
-- be written yet, because closing a domain requires knowing what is IN it —
-- a constraint added blind either rejects live rows or enshrines a typo. This
-- file is that prerequisite, and it is the whole reason it runs first.
--
-- ---------------------------------------------------------------------------
-- ✅ low_supply_units — numeric, nullable. AND NULLABLE IS THE USEFUL PART.
--
-- The low-stock threshold exists as a column. When the red-for-zero idea was
-- rejected, the counter-proposal was that what deserves emphasis is BELOW THE
-- THRESHOLD rather than ZERO — and that was an opinion at the time. It now has
-- a column under it.
--
-- ⚠️ And `nullable` makes "no threshold set" REPRESENTABLE and DIFFERENT FROM
-- ZERO, which decides how the catalogue draws it. Three states, not two:
--
--     null   ⇒ nobody set a threshold. The screen says nothing.
--     0      ⇒ somebody set zero. That is a CLAIM — "warn me only at empty" —
--              and it is not the same fact as the one above.
--     n > 0  ⇒ warn under n.
--
-- Collapsing null and 0 into "no warning" is the same error as `0 ₪` standing
-- for an unknown cost, which this module already fixed once with
-- cost_is_estimated. The counts below say whether the distinction is live in
-- this data or only in the schema.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WITNESS OF TRUTH — item 1ج. The accounting_direction rows must SUM to the
-- number of products, and so must the low_supply_units rows: every product
-- falls in exactly one bucket of each, because both branches group the whole
-- table with no filter. 067_1 measured EIGHT products. If either block sums to
-- something else, the query is not seeing the table and no row in it means
-- anything — including a comforting «(فاضي) 0».
-- ==========================================================================

select 'accounting_direction'                                as field,
       coalesce(p.accounting_direction, '⚠️ (فاضي — null)')  as value,
       count(*)                                              as products
from public.products p
group by p.accounting_direction

union all

select 'low_supply_units',
       case
         when p.low_supply_units is null then '⚠️ (بلا حدّ مضبوط — null)'
         when p.low_supply_units = 0     then '0 — حدٌّ مضبوطٌ على صفر، وهو ادّعاء لا غياب'
         else 'حدٌّ مضبوط: ' || p.low_supply_units::text
       end,
       count(*)
from public.products p
group by 2

order by 1, 3 desc, 2;
