-- ==========================================================================
-- 080_1b -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ DEPOSITED AFTER IT RAN, AND WRITTEN BY REVIEW RATHER THAN HERE. The
-- executable text below is verbatim from the run; this header is reconstructed
-- from the reasoning that came with it, so it is NOT byte-identical to the
-- copy the owner executed.
--
-- ⚠️ AND ITS ABSENCE WAS THE POINT. A whole file ran against the database and
-- existed nowhere — while its result became load-bearing for the catalogue's
-- unit column and for the document screen. Every guard here reads docs/sql and
-- nothing else, so an undeposited script is invisible to all of them. Same
-- story as refuse_archiving_stocked_storage, applied to us this time.
--
-- ---------------------------------------------------------------------------
-- THE QUESTION 080_1 CANNOT ANSWER: is the COLUMN'S TYPE closed?
--
-- 080_1 reads pg_constraint joined through conrelid, so it sees constraints
-- attached to TABLES. A DOMAIN's constraint has conrelid = 0 and is discarded
-- by that join before contype is ever read — the narrowing moved out of the
-- WHERE and into the JOIN, which is why it did not look like narrowing.
--
-- ⚠️ AND A CLOSED COLUMN CAN LOOK WIDE OPEN UNDER BOTH OF THE QUERIES WE HAD
-- ALREADY RUN. Measured in four steps, not argued:
--
--     create domain discount_kind_t as text check (value in ('percent','amount'));
--     alter table stock_documents add column probe_kind discount_kind_t;
--
--     1) information_schema.columns  → data_type 'text' · is_nullable 'YES'
--                                      identical to a wide-open column
--     2) 080_1's first draft         → ZERO ROWS. No constraint at all.
--     3) pg_constraint on contypid   → conrelid = 0, and there it is
--     4) insert «مبيعات الصالون»      → ERROR: value for domain … violates
--                                      check constraint
--
-- So this asks the TYPE what it is, rather than asking a table what is
-- attached to it.
--
-- ---------------------------------------------------------------------------
-- ✅ MEASURED, and two of the four answers were not expected:
--
--     no column of the three tables has a domain type
--     🔒 products.kind          product · set
--     🔒 products.base_unit     pcs · ml · g
--     🔒 accounting_direction   common + the seven business types
--     🔒 entered_uom            package · portion · unit
--
-- ⚠️ WITNESS OF TRUTH — item 1ج, and it is INDEPENDENT of the question: doc_type
-- and entered_uom are known enums and must come back labelled 🔒 with their
-- values spelled out. They did — and two more turned up that nobody predicted
-- (kind, base_unit), which is what makes the query's SILENCE about the rest
-- worth something.
--
-- ⇒ base_unit's three values are what the catalogue's balance column stands
-- on: the unit is read from the row, never written as a constant. And
-- entered_uom's three are the document screen's input units, ready.
-- ==========================================================================

select c.relname as table_name, a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as declared_type,
       case t.typtype
         when 'b' then 'b — أساسيّ: المجال مفتوحٌ إلا إذا قيّده CHECK على الجدول (٠٨٠_١)'
         when 'e' then '🔒 e — enum: المجال مغلقٌ بالنوع نفسه'
         when 'd' then '🔒 d — domain: مغلقٌ بالنوع، و٠٨٠_١ ما بيشوفه لأن conrelid = 0'
         when 'c' then 'c — نوعٌ مركّب' when 'r' then 'r — مدى'
         when 'm' then 'm — مدًى متعدّد' when 'p' then 'p — نوعٌ زائف'
         else '⚠️ typtype = ' || t.typtype::text
       end as type_kind,
       coalesce(
         (select string_agg(e.enumlabel, ' · ' order by e.enumsortorder)
            from pg_enum e where e.enumtypid = t.oid),
         (select string_agg(pg_get_constraintdef(con.oid), ' · ')
            from pg_constraint con where con.contypid = t.oid),
         '—') as closed_domain
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_type  t on t.oid = a.atttypid
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('products', 'stock_documents', 'stock_movements')
  and a.attnum > 0 and not a.attisdropped
order by c.relname, a.attnum;
