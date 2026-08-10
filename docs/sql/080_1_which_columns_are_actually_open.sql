-- ==========================================================================
-- 080_1 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ RUN THIS BEFORE ACTING ON 080_2. It measures what 080_2's header ASSUMED.
--
-- ---------------------------------------------------------------------------
-- 🔴 "FIVE COLUMNS WITH AN OPEN DOMAIN" WAS NEVER MEASURED. IT WAS INFERRED
-- FROM A QUERY THAT STRUCTURALLY CANNOT SEE A CONSTRAINT.
--
-- 079b_1 reads information_schema.columns: name, type, nullability, default. A
-- CHECK is in none of those. `text · YES` is not weak evidence of an open
-- domain — it is NO evidence, and the output is identical either way.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THE CORRECTION WAS MADE FROM A MARKDOWN FILE, WHICH IS THE SAME
-- SUBSTITUTION IN OTHER CLOTHES. THIS IS HELD AS A HYPOTHESIS UNTIL THIS FILE
-- RUNS.
--
-- The claim "products.accounting_direction has a CHECK of eight values" rests
-- on DATABASE_DIAGRAM.md:526 and :447, ADR-047, and serviceForm.test.js:126.
-- The documentation is very probably right. But :447 records that SOMEBODY
-- VERIFIED IT ONCE — which is not a reading of the catalogue today, and a
-- later migration would not have come back and edited the sentence. Replacing
-- an inference about information_schema with a quotation from a file is
-- replacing one non-measurement with another.
--
-- ⇒ So it is written below as an EXPECTED RESULT and not as a witness, and it
-- is allowed to come back absent. If it does, that is the finding.
--
-- ⚠️ WITNESS OF TRUTH — item 1ج, ONE witness and it is independent of
-- everything in question here:
--
--     products · CHECK (units_per_package > 0)   — measured in 064_2
--
-- An earlier draft of this file listed the accounting_direction CHECK as a
-- witness TOO — that is, it made its own hypothesis the proof that the tool
-- works. Had a migration dropped that constraint, the witness would have
-- announced "this query cannot see constraints" and pointed the reader at the
-- tool instead of at the discovery. That is 079b_4's false witness again, one
-- round later, and it is why witnesses may only be facts that nothing in the
-- file depends on.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND BLOCK 2 EXISTS BECAUSE THE FIRST DRAFT WAS BLIND TO DOMAINS — WHILE
-- ITS OWN HEADER NAMED THE DANGER.
--
-- The header said `contype='c'` is the narrow question that once missed a
-- guard because it was a TYPE and not a constraint. And then the query said
-- `join pg_class c on c.oid = con.conrelid`. A DOMAIN's constraint carries
-- conrelid = 0, so it is discarded by the JOIN before contype is ever read.
--
-- ⚠️ THE NARROWING MOVED FROM THE WHERE INTO THE JOIN, WHICH IS WHY IT WAS
-- INVISIBLE. Measured in four steps, not argued:
--
--     create domain discount_kind_t as text check (value in ('percent','amount'));
--     alter table stock_documents add column probe_kind discount_kind_t;
--
--     1) information_schema.columns  → data_type 'text' · is_nullable 'YES'
--                                      identical to a wide-open column
--     2) this file's first draft     → ZERO ROWS. No constraint at all.
--     3) pg_constraint on contypid   → conrelid = 0, and there it is
--     4) insert «مبيعات الصالون»      → ERROR: value for domain … violates
--                                      check constraint
--
-- ⇒ A COMPLETELY CLOSED COLUMN CAN LOOK WIDE OPEN UNDER BOTH QUERIES WE RAN.
--
-- ⚠️ AND THE BITTEREST PART: the answer was ONE UNSELECTED COLUMN IN A RESULT
-- SET WE ALREADY HAD. information_schema.columns carries `domain_name`, and it
-- is populated. 079b_1 selected name, type, nullability and default, and not
-- that one. So this is not "the answer was in the repository" — the answer was
-- INSIDE THE ROWS ON OUR SCREEN, in a column nobody asked for.
--
-- ⇒ A narrow PROJECTION hides exactly as well as a narrow filter, and it hides
-- better, because a filter at least announces itself in the WHERE. Block 3
-- reads domain_name for the three tables so the question closes from both
-- directions.
-- ==========================================================================

select
  '1 · قيود الجداول'                 as scope,
  c.relname::text                    as object,
  case con.contype
    when 'c' then 'CHECK'
    when 'p' then 'PRIMARY KEY'
    when 'f' then 'FOREIGN KEY'
    when 'u' then 'UNIQUE'
    when 'n' then 'NOT NULL'
    when 'x' then 'EXCLUDE'
    when 't' then 'TRIGGER'
    else '⚠️ ' || con.contype::text
  end                                as kind,
  con.conname::text                  as constraint_name,
  pg_get_constraintdef(con.oid)      as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('products', 'stock_documents', 'stock_movements')

union all

-- ⚠️ AGGREGATED SO IT CANNOT VANISH. A domain constraint lives on the TYPE, not
-- on any table, so it has no conrelid to join by and the block above can never
-- reach it. And with no domains in the schema this must still print a row
-- saying so — an absent block and "there are none" are the same silence.
select
  '2 · قيود الـdomains بالسكيما',
  coalesce(string_agg(distinct t.typname::text, ' · '), '✅ ولا domain بسكيما public'),
  'DOMAIN CHECK',
  coalesce(string_agg(con.conname::text, ' · '), '—'),
  coalesce(string_agg(pg_get_constraintdef(con.oid), '   ⏐   '), '—')
from pg_constraint con
join pg_type t on t.oid = con.contypid
where t.typnamespace = 'public'::regnamespace

union all

-- ⚠️ AND FROM THE OTHER DIRECTION: does any column of the three tables have a
-- domain for its type? This is the column 079b_1 had in hand and did not
-- select. Aggregated for the same reason as block 2.
select
  '3 · أعمدة التلاتة اللي نوعها domain',
  coalesce(
    string_agg(k.table_name::text || '.' || k.column_name::text || ' → ' || k.domain_name::text, ' · '),
    '✅ ولا عمود من التلاتة نوعُه domain — فالمجال مفتوحٌ فعلًا حيث لا CHECK فوق'),
  'uses domain',
  '—',
  '—'
from information_schema.columns k
where k.table_schema = 'public'
  and k.table_name in ('products', 'stock_documents', 'stock_movements')
  and k.domain_name is not null

order by 1, 2, 3, 4;
