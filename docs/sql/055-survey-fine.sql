-- ==========================================================================
-- 055 -- SURVEY ONLY, before anything about the fine is designed.
--
-- PREPARED, NOT RUN BY ME. The owner executes it. Read-only: no DDL.
--
-- ---------------------------------------------------------------------------
-- TWO QUESTIONS, AND "من" COMES BEFORE "كم"
--
-- ARCHITECTURE.md:582 already records the harder half, from a round that had
-- nothing to do with fines: a GENERAL storage with two responsibles has nobody
-- to charge — "neither of them can be short of anything" — so the fine "cannot
-- find whoever it is meant to bill". Whom to charge is a question about the
-- data model, and it is prior to how much.
--
-- ⚠️ AND THE SAME PARAGRAPH RECORDS A LIVE HAZARD: rows in storage_responsibles
-- left over from when a storage was general would let a fine calculation pick
-- an employee who was marked a year ago, for a shortage in a storage she never
-- saw, with no screen ever having shown the link. The rows were deleted and a
-- mirror key made it structural — but that was one round's cleanup, and this
-- asks the database whether it is still true.
--
-- ---------------------------------------------------------------------------
-- ⚠️ EVERY QUERY BELOW READS A WHOLE CATEGORY AND FILTERS BY EYE, which is
-- CLAUDE.md §4b and was written after this exact instrument failed four times
-- in one round. `where column_name = 'fine_percent'` would find what I already
-- expect and stay silent about everything else — and the fourth failure was a
-- TYPE standing where a constraint was looked for. So: all columns, all
-- constraints, all enums. The reading is done by a person, not by the WHERE.
-- ==========================================================================

-- 1 -- storages, EVERY column. fine_percent and fine_basis are the two the
-- repository names; what else is on that table has never been read here.
select
  c.column_name,
  c.data_type,
  c.udt_name,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'storages'
order by c.ordinal_position;

-- 2 -- every constraint on storages, with no contype filter.
--
-- ⚠️ The filter is what hid entry_uom: asking pg_constraint for contype = 'c'
-- could never see a guard that was a type. Reading all of them and looking is
-- the only version of this that cannot fail the same way.
select
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace n on n.oid = cl.relnamespace
where n.nspname = 'public'
  and cl.relname = 'storages'
order by con.contype, con.conname;

-- 3 -- every enum in the schema and its labels.
--
-- fine_basis may be a text column with a CHECK, or a type like entry_uom, or
-- neither. This asks the question the wrong way round on purpose — list what
-- exists, then look for the one that matters — because the right-way-round
-- question is what got it wrong last time.
select
  t.typname,
  e.enumlabel,
  e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

-- 4 -- ⚠️ WHERE A FINE MIGHT ALREADY BE RECORDED, asked by shape rather than by
-- table name. Searching a table I guessed would find nothing and prove nothing;
-- searching every column in the schema for the words a fine would be spelled
-- with finds it wherever somebody put it — including in a table this
-- conversation has never mentioned.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and (c.column_name like '%fine%'
    or c.column_name like '%penalt%'
    or c.column_name like '%deduct%'
    or c.column_name like '%charge%')
order by c.table_name, c.column_name;

-- 5 -- who a storage can point at, which is the "من" half.
--
-- Both the column on storages and the join table, because ARCHITECTURE:590 says
-- the calculation would have to choose between them — and a design that has to
-- choose has two answers to one question until somebody decides.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('storages', 'storage_responsibles')
  and (c.column_name like '%employee%' or c.column_name like '%owner%'
    or c.column_name like '%kind%' or c.column_name like '%responsib%')
order by c.table_name, c.column_name;

-- 6 -- and whether the leftover rows the diagram says were deleted are gone.
--
-- ⚠️ A count per storage kind, not a total. A total of zero and "no general
-- storages exist" are the same number, and only one of them means the cleanup
-- held.
select
  s.kind,
  count(distinct s.id) as storages,
  count(r.id) as responsible_rows
from public.storages s
left join public.storage_responsibles r on r.storage_id = s.id
group by s.kind
order by s.kind;
