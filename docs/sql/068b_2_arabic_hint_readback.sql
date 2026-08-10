-- ==========================================================================
-- 068b · QUERY 2 of 3 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 068a.
--
-- ---------------------------------------------------------------------------
-- WHY: 068a deposits Arabic into the database twice — a `using hint` that
-- reaches the user's screen verbatim, and a `comment on function` read by
-- database tooling. Neither is a code comment, and both are read back here
-- because a change file carries no query.
--
-- ⚠️ The hint is compared to its FIXED PART only. It ends with a list of
-- product names built at runtime, so a whole-string match would be comparing
-- against data. What is being verified is that the sentence survived the trip
-- and that it names the way out — «نقل البضاعة … وبعدها إزالة التأشير» — not
-- that any particular product is in it.
--
-- EXPECTED: two rows, present_expect_true = true on both.
-- ==========================================================================

with fn as (
  select p.prosrc, obj_description(p.oid, 'pg_proc') as description
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'refuse_unlinking_stocked_folder'
),
expected (what, sentence) as (values
  ('hint',
   'ما بينفع تشيل هذا المجلّد من المستودع وفيه بضاعة منه. نقل البضاعة لمستودع تاني أو شطبها، وبعدها إزالة التأشير. الأصناف اللي لسّه فيها رصيد: '),
  ('comment',
   'بيرفض إزالة مجلّد من مستودع لسّه فيه رصيد من منتجات هذا المجلّد. السبب إن الإزالة بتخفي المنتجات من شجرة المستودع وبتترك حركاتها مكانها، فبيصير رصيد ما حدا بيشوفه — والنقل ما بينقذه لأنه بدّه مجلّدًا مشتركًا وهو انشال. الرفض بيسمّي الأصناف والمخرج، والفعل بيرجع مشروعًا بعد تفريغ الرفّ.')
)
select
  e.what,
  e.sentence,
  -- ⚠️ coalesce, and the case it actually covers is A FUNCTION THAT EXISTS WITH
  -- ITS COMMENT MISSING: obj_description returns null, `null = 'text'` is
  -- UNKNOWN — not false — in a column named expect_true.
  --
  -- An earlier comment here claimed it covered a MISSING FUNCTION. It did not:
  -- with `cross join` and an empty fn, there are no rows at all, so coalesce
  -- never runs on anything. The protection was real and was describing the
  -- wrong hazard.
  coalesce(
    case e.what
      when 'hint'    then position(e.sentence in f.prosrc) > 0
      when 'comment' then f.description = e.sentence
    end,
    false
  ) as present_expect_true
from expected e
-- ⚠️ LEFT JOIN ... ON TRUE, not CROSS JOIN, so that a missing function is
-- REPORTED rather than merely absent.
--
-- With cross join, no function means zero rows — and zero rows reads as "the
-- query returned nothing", which a person takes for a fault in the query. With
-- the left join it is two rows saying false, which reads as "the sentence is
-- not there" — news about the function, which is what was asked.
--
-- Same distinction as zero versus a dash in the balance column, and as an
-- answer versus a failed parse in the schema guard: an absence and an answer
-- must not look alike.
left join fn f on true
order by e.what;
