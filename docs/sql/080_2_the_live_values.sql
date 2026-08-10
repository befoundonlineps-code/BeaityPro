-- ==========================================================================
-- 080_2 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ RUN 080_1 FIRST. It measures which of these columns is actually open, and
-- this file's original header got that wrong on the only one we could check.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS ASKS: what is actually stored in five text columns, one on the
-- catalogue's table and four on the document screen's.
--
--     products.accounting_direction          ← the catalogue screen
--     stock_documents.discount_kind          ← the document screen
--     stock_documents.payment_method         ← the document screen
--     stock_documents.transport_paid_to      ← the document screen
--     stock_movements.line_discount_kind     ← the document screen
--
-- ---------------------------------------------------------------------------
-- 🔴 AND THE HEADER THAT USED TO SIT HERE WAS WRONG TWICE OVER. It is quoted
-- rather than deleted, because the shape of the error is worth more than the
-- correction.
--
--     "Five text columns have an OPEN domain — no enum, no CHECK"
--     "accounting_direction is the field a design tool filled with a value
--      nobody defined. Every other field refused an invented value because its
--      TYPE or its CHECK refused it, and this one had nothing to refuse with."
--
-- ⚠️ FAULT 1 — "open domain" was never measured. It was read off 079b_1, which
-- lists name · type · nullability · default. A CHECK appears in none of those.
-- `text · YES` is not weak evidence of an open domain; it is NO evidence, and
-- the output looks identical either way. 080_1 asks pg_constraint instead.
--
-- ⚠️ FAULT 2 — and on the one column checkable by hand, the answer is the
-- opposite. products.accounting_direction HAS a CHECK, eight values,
-- DATABASE_DIAGRAM.md:526, verified against the live database at :447 and
-- explained in ADR-047. So the sentence "nothing to refuse with" describes the
-- one field in the list that demonstrably does have something to refuse with —
-- and it would have refused US: the proposed dropdown («مبيعات الصالون /
-- استهلاك داخليّ») is not in that domain.
--
-- ⚠️ AND THE "INVENTED VALUE" WAS NEVER IN THE COLUMN EITHER. «مبيعات الصالون»
-- appears in no row. The invention happened in a design tool; the sentence was
-- phrased as though the database had accepted it. The REASON to be careful
-- with an open domain stands on its own. The evidence offered for it did not
-- exist.
--
-- ---------------------------------------------------------------------------
-- ✅ SO WHAT THIS FILE IS FOR, STATED HONESTLY:
--
-- Closing a domain requires knowing what is IN it — a constraint added blind
-- either rejects live rows or enshrines a typo. That is true of whichever of
-- the four remaining columns 080_1 shows to be genuinely unconstrained.
--
-- ⚠️ AND A CONSTRAINT IS NOT WRITTEN FROM THE DATA ALONE. Four of eight
-- products carry a value and four are null, and that may not be chance: six
-- seed triggers fire on salons. Before any constraint, the question is WHO
-- WROTE these values. If they came from seeding, the column has never been
-- written by an application, and the decision might be to rename it or drop it
-- rather than constrain it. A constraint copied from the data enshrines what
-- happens to be there and refuses a legitimate value not yet used.
--
-- ---------------------------------------------------------------------------
-- ⚠️ FOUR THINGS THIS QUERY DOES THAT THE FIRST DRAFT DID NOT, AND THE LAST
-- ONE WAS MEASURED ON A TEST HARNESS RATHER THAN REASONED.
--
-- 1. coalesce(col, '⚠️ فاضي') CANNOT SEE ''. An empty string printed a blank
--    cell that reads exactly like null — on the one column that has already
--    received an invented value, in a project that has twice paid for
--    Number('') === 0. Four states now, not two: null · '' · whitespace only ·
--    a real value.
--
-- 2. low_supply_units is numeric WITH NO CHECK, so a NEGATIVE threshold is
--    storable — and a negative threshold is not a threshold. It is an alert
--    that can never fire, and it looks configured. Its own branch.
--
-- 3. ⚠️ THE WITNESS WAS THE WRONG KIND. The draft said the blocks "must sum to
--    eight, because 067_1 measured eight products". But 067_1's eight came out
--    of `cross join storages … where p.salon_id = s.salon_id` — products of
--    salons THAT HAVE STORAGES — while the blocks below read products with no
--    filter at all. A number remembered from another query under another
--    filter is not a witness: it is a second thing that can be wrong, and when
--    the two disagree it points the reader's suspicion at the wrong half.
--
--    ✅ So the witness is INTERNAL. Row 0 counts the same table in the same
--    query, and each block below it must sum to it. Nothing is remembered.
--
-- 4. ⚠️ AND THIS ONE CAME OUT OF RUNNING IT, NOT OUT OF READING IT. On a table
--    holding «مبيعات الصالون» and «مبيعات الصالون » — one trailing space — the
--    output was TWO ROWS THAT LOOK IDENTICAL. A space inside «» is invisible
--    in Arabic, and two identical-looking rows read as a rendering glitch
--    rather than as the finding. Which is precisely the most likely fault on
--    an open text column: one meaning, two spellings, and a report that splits
--    a total in silence.
--
--    ✅ So the padded side prints ITS LENGTH AND ITS TRIMMED LENGTH. The
--    difference becomes a number instead of a pixel.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND EVERY COLUMN IS CAST ::text BEFORE btrim/length TOUCH IT. Which
-- columns are open text is being relayed from 079b_1's output rather than read
-- here, and if one of them turns out to be an enum after all, btrim would
-- abort the WHOLE query and this file would report nothing about the other
-- four. The cast costs nothing and makes a wrong premise produce a tidy closed
-- set instead of an error.
-- ==========================================================================

select '0 · إجمالي products — شاهدٌ داخليّ، البلوكان تحته لازم يجمعا عليه'
                                                             as field,
       '—'                                                   as value,
       count(*)                                              as products
from public.products p

union all

select '1 · products.accounting_direction',
       case
         when p.accounting_direction is null
           then '⚠️ (فاضي — null: ما حدا كتب إشي)'
         when p.accounting_direction::text = ''
           then '🔴 (نصٌّ فارغ '''' — إشي كتب فراغًا، وهاد غير null)'
         when btrim(p.accounting_direction::text) = ''
           then '🔴 (مسافاتٌ فقط — طوله ' || length(p.accounting_direction::text)::text || ')'
         when btrim(p.accounting_direction::text) <> p.accounting_direction::text
           then '🔴 «' || p.accounting_direction::text || '» — مسافةٌ زائدة على الطرف: طوله '
                || length(p.accounting_direction::text)::text || ' والنصّ نفسه '
                || length(btrim(p.accounting_direction::text))::text
         else '«' || p.accounting_direction::text || '»'
       end,
       count(*)
from public.products p
group by 2

union all

select '2 · products.low_supply_units',
       case
         when p.low_supply_units is null then '⚠️ (بلا حدّ مضبوط — null)'
         when p.low_supply_units = 0     then '0 — حدٌّ مضبوطٌ على صفر، وهو ادّعاء لا غياب'
         when p.low_supply_units < 0     then '🔴 حدٌّ سالب: ' || p.low_supply_units::text
                                              || ' — لا يمكن بلوغه، فالتنبيه لا ينطلق أبدًا'
         else 'حدٌّ مضبوط: ' || p.low_supply_units::text
       end,
       count(*)
from public.products p
group by 2

union all

select '3 · إجمالي stock_documents — شاهدٌ داخليّ للأعمدة التلاتة تحته',
       '—',
       count(*)
from public.stock_documents d

union all

-- ⚠️ الأعمدة التلاتة بمرورٍ واحد عبر `lateral (values …)` بدل تلات كتل
-- متطابقة: نفس التمييز الرباعيّ مكتوبٌ مرّةً واحدة، فما بيقدر ينحرف بينهن.
-- وكلُّ عمودٍ إله `field` خاصّ به، فصفوفُه لازم تجمع على الصفّ ٣ لحاله.
select '4 · stock_documents.' || t.col,
       case
         when t.val is null       then '⚠️ (فاضي — null: ما حدا كتب إشي)'
         when t.val = ''          then '🔴 (نصٌّ فارغ '''' — إشي كتب فراغًا، وهاد غير null)'
         when btrim(t.val) = ''   then '🔴 (مسافاتٌ فقط — طوله ' || length(t.val)::text || ')'
         when btrim(t.val) <> t.val
           then '🔴 «' || t.val || '» — مسافةٌ زائدة على الطرف: طوله '
                || length(t.val)::text || ' والنصّ نفسه ' || length(btrim(t.val))::text
         else '«' || t.val || '»'
       end,
       count(*)
from public.stock_documents d
cross join lateral (values
  ('discount_kind',     d.discount_kind::text),
  ('payment_method',    d.payment_method::text),
  ('transport_paid_to', d.transport_paid_to::text)
) as t(col, val)
group by 1, 2

union all

select '5 · إجمالي stock_movements — شاهدٌ داخليّ للعمود تحته',
       '—',
       count(*)
from public.stock_movements m

union all

select '6 · stock_movements.line_discount_kind',
       case
         when m.line_discount_kind is null
           then '⚠️ (فاضي — null: ما حدا كتب إشي)'
         when m.line_discount_kind::text = ''
           then '🔴 (نصٌّ فارغ '''' — إشي كتب فراغًا، وهاد غير null)'
         when btrim(m.line_discount_kind::text) = ''
           then '🔴 (مسافاتٌ فقط — طوله ' || length(m.line_discount_kind::text)::text || ')'
         when btrim(m.line_discount_kind::text) <> m.line_discount_kind::text
           then '🔴 «' || m.line_discount_kind::text || '» — مسافةٌ زائدة على الطرف: طوله '
                || length(m.line_discount_kind::text)::text || ' والنصّ نفسه '
                || length(btrim(m.line_discount_kind::text))::text
         else '«' || m.line_discount_kind::text || '»'
       end,
       count(*)
from public.stock_movements m
group by 2

order by 1, 3 desc, 2;
