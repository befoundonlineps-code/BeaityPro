-- ==========================================================================
-- 105 -- SURVEY ONLY. Read-only: nothing is written, nothing is locked.
--
-- PREPARED, NOT RUN BY ME. Safe at any time, on any data.
--
-- ---------------------------------------------------------------------------
-- WHY THIS EXISTS: A CLAIM OF STRUCTURAL IMPOSSIBILITY WITH NO MEASUREMENT
-- UNDER IT.
--
-- It was stated in review that two people counting one storage at the same
-- time is impossible, and that a product counted twice in one session
-- overwrites rather than accumulates. Both were read out of the PREPARED
-- script 054a -- that is, out of a file, which is a statement of intent and
-- not a statement about this database.
--
-- ⚠️ AND THE RUN LOG SAYS SO ITSELF. docs/sql/README.md, directly under the
-- ٠٥٢ج row:
--
--     «٠٥٣–٠٦٣ ليست مسجَّلة هنا — لا يعني ذلك أنها لم تُشغَّل، بل أن حالتها
--      لم تُكتب لحظة تأكيدها. والفراغ يُعلن ولا يُملأ بالاستنتاج.»
--
-- 054a falls inside that range. So its status is not "unknown to me" — it is
-- DECLARED unrecorded by the log that exists precisely for this. Inferring it
-- from "the stocktake screen works" would be the inference that log forbids:
-- the screen working proves the TABLES exist. It proves nothing whatsoever
-- about a partial unique INDEX, which is silent until two rows collide.
--
-- ⇒ That is the whole hazard class of a uniqueness guarantee: it is invisible
-- while it holds and invisible while it is absent. Only the catalogue tells
-- them apart.
--
-- ---------------------------------------------------------------------------
-- WHAT TO LOOK AT, AND WHAT WOULD FALSIFY THE CLAIM
--
--   Block 1  one row expected, indexname = stocktake_sessions_one_open_per_storage
--            🔴 AND indexdef MUST CONTAIN `WHERE (document_id IS NULL)`.
--               A non-partial index here would be WORSE than none: it would
--               forbid a storage from ever being counted a second time.
--            🔴 AND it must be UNIQUE. `CREATE INDEX` without it reads almost
--               identically at a glance and enforces nothing at all.
--            Zero rows  ⇒ the claim is false, parallel sessions are possible.
--
--   Block 2  one row expected, conname = stocktake_counts_one_per_product,
--            contype = 'u', over exactly (session_id, product_id).
--            Zero rows  ⇒ counting a product twice inserts a SECOND row, and
--                         which one posts is whichever the planner returns.
--
--   Block 3  counter-evidence, and it is the point of the file rather than a
--            garnish: the catalogue can say the index exists while the data
--            says otherwise is impossible -- but a storage carrying two open
--            sessions TODAY would mean the index was created after the rows,
--            or is not what block 1 claims. Expected: zero rows.
--
--   Block 4  the same question asked of the counts: any (session_id,
--            product_id) appearing more than once. Expected: zero rows.
--
-- ⚠️ Blocks 3 and 4 return zero rows on an EMPTY table too, and the stocktake
-- tables may well be empty after 089. So block 5 prints the row counts beside
-- them -- a zero that comes from "no violations" and a zero that comes from
-- "no data" read identically, and only the count separates them.
-- ==========================================================================

-- ── Block 1 — the partial unique index ────────────────────────────────────
select
  i.indexname,
  i.indexdef,
  (i.indexdef ilike '%unique%')                        as is_unique,
  (i.indexdef ilike '%where (document\_id is null)%')  as is_partial_on_open
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename  = 'stocktake_sessions'
order by i.indexname;

-- ── Block 2 — the per-product unique constraint ───────────────────────────
select
  cl.relname                                   as table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid)                as definition
from pg_constraint con
join pg_class cl on cl.oid = con.conrelid
join pg_namespace ns on ns.oid = cl.relnamespace
where ns.nspname = 'public'
  and cl.relname = 'stocktake_counts'
  and con.contype in ('u', 'p')
order by con.conname;

-- ── Block 3 — counter-evidence: two open sessions on one storage ──────────
select
  s.salon_id,
  s.storage_id,
  count(*)                as open_sessions,
  array_agg(s.started_at) as started_ats
from public.stocktake_sessions s
where s.document_id is null
group by s.salon_id, s.storage_id
having count(*) > 1;

-- ── Block 4 — counter-evidence: one product counted twice in one session ──
select
  c.session_id,
  c.product_id,
  count(*)                   as rows_for_this_product,
  array_agg(c.counted_base)  as counted_bases
from public.stocktake_counts c
group by c.session_id, c.product_id
having count(*) > 1;

-- ── Block 5 — is a zero above a finding, or an empty table? ───────────────
select
  (select count(*) from public.stocktake_sessions)                            as sessions_total,
  (select count(*) from public.stocktake_sessions where document_id is null)  as sessions_open,
  (select count(*) from public.stocktake_counts)                              as counts_total;
