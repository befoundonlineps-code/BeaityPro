-- ==========================================================================
-- 080_1 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ RUN THIS BEFORE ACTING ON 080_2. It measures the thing 080_2's header
-- ASSUMED, and on the one column we could check by hand the assumption was
-- already false.
--
-- ---------------------------------------------------------------------------
-- 🔴 "FIVE COLUMNS WITH AN OPEN DOMAIN" WAS NEVER MEASURED. IT WAS INFERRED
-- FROM A QUERY THAT STRUCTURALLY CANNOT SEE A CONSTRAINT.
--
-- 079b_1 reads information_schema.columns: name, type, nullability, default.
-- A CHECK constraint is in none of those. So `text · YES` was read as "open
-- domain", and that reading is not weak evidence — it is NO evidence. The
-- column list would look identical either way.
--
-- ⚠️ AND products.accounting_direction IS CLOSED. It has a CHECK limiting it
-- to eight values — common + the seven business types — and this was not
-- hidden:
--
--     docs/DATABASE_DIAGRAM.md:526   the CHECK, on products, named
--     docs/DATABASE_DIAGRAM.md:447   the owner VERIFIED it against the live
--                                    database, "مطابق حرفيًا لنظيره على services"
--     docs/ARCHITECTURE.md ADR-047   why it is a CHECK and not an enum, and
--                                    why its values deliberately mirror
--                                    business_type without reusing it
--     lib/serviceForm.test.js:126    pins the sibling constraint, "read back
--                                    off the live database"
--
-- ⇒ SO THE THREE LIVE VALUES ARE NOT A RIVAL TAXONOMY THAT CREPT IN. They are
-- members of the domain the schema declares, and they read as "salon
-- specialities" because ADR-047 chose that value set ON PURPOSE:
-- business_type decides WHO SEES a service, accounting_direction decides WHICH
-- DEPARTMENT ITS REVENUE COUNTS TO. Same words, different question.
--
-- ⇒ AND THE PROPOSED DROPDOWN («مبيعات الصالون / استهلاك داخليّ») WOULD BE
-- REFUSED BY THAT CHECK. Which reverses 080_2's original claim exactly: it
-- said this was the field with "nothing to refuse with". It has something to
-- refuse with, and it would have refused us.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THIS IS THE FIFTH TIME THE ANSWER WAS ALREADY IN THIS REPOSITORY.
-- CLAUDE.md keeps a table of four — the stocktake frame, the check-page limit,
-- why unit_cost is NOT NULL, the text of the stock functions. This one is the
-- worst of the five: the answer was written in TWO places, explained in an
-- ADR, and pinned by a test that had read it off the live database. The rule
-- says search the repository BEFORE naming an unknown in a report. It was not
-- searched.
--
-- ---------------------------------------------------------------------------
-- SO THIS ASKS THE RIGHT CATALOGUE, AND ASKS IT WIDE — item 4ب. Every
-- constraint of every type on all three tables, no filter on contype and no
-- filter on column. `contype = 'c'` is exactly the narrow question that once
-- missed a guard because it was a TYPE and not a constraint at all.
--
-- ⚠️ WITNESS OF TRUTH — item 1ج. Two constraints on products are already known
-- and MUST appear:
--
--     the CHECK on accounting_direction   DATABASE_DIAGRAM:526, verified :447
--     CHECK (units_per_package > 0)       measured in 064_2
--
-- If either is missing, this query is not seeing constraints, and its silence
-- about the other four columns means nothing whatsoever.
--
-- ⚠️ AND contype IS CAST ::text. It is type "char", and concatenating it
-- unquoted answers `operator is not unique` and drops the whole query — a
-- fault found by RUNNING 081_1, not by reading it. Applied here before it can
-- happen a second time.
-- ==========================================================================

select
  c.relname                        as table_name,
  case con.contype
    when 'c' then 'CHECK'
    when 'p' then 'PRIMARY KEY'
    when 'f' then 'FOREIGN KEY'
    when 'u' then 'UNIQUE'
    when 'n' then 'NOT NULL'
    when 'x' then 'EXCLUDE'
    when 't' then 'TRIGGER'
    else '⚠️ ' || con.contype::text
  end                              as kind,
  con.conname                      as constraint_name,
  pg_get_constraintdef(con.oid)    as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('products', 'stock_documents', 'stock_movements')
order by c.relname, con.contype, con.conname;
