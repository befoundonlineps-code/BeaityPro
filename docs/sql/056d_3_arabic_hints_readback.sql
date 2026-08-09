-- ==========================================================================
-- 056d · QUERY 3 of 7 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 064 (all five) -> 056c -> 056d (all seven). RUN AFTER 056c.
--
-- ---------------------------------------------------------------------------
-- WHY: the six Arabic hints, read back OUT OF THE DATABASE and compared to the
-- sentences typed here, character for character.
--
-- ⚠️ NOT "contains Arabic characters" — that says the text is Arabic and does
-- not say it is the RIGHT Arabic. 048 measured eighteen messages that were
-- perfectly valid Arabic-shaped text and were all wrong.
--
-- ⚠️ THIS IS WHERE THE PROJECT'S READ-BACK RULE IS ACTUALLY DISCHARGED. 056c
-- deposits six hints and cannot read them back itself — a change file carries no
-- verification query, by the structural rule. `using hint` is NOT a comment: it
-- reaches the user's screen verbatim, and it is the second rung of this
-- project's error-message ladder.
--
-- EXPECTED: six rows, present_expect_true = true on all six.
-- ==========================================================================

with fn as (
  select p.prosrc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'post_stocktake_session'
),
expected (code, sentence) as (values
  ('session_not_found',      'جلسة الجرد غير موجودة'),
  ('session_already_posted', 'هذا الجرد مُرحَّل من قبل'),
  ('product_not_found',      'منتج بالمستند غير موجود'),
  ('count_invalid',          'العدد لازم يكون صفرًا أو أكبر'),
  ('storage_not_found',      'مستودع الجرد غير موجود'),
  ('fine_policy_missing',    'ما بينفع ترحيل الجرد وهذا المستودع بلا سياسة غرامة. تعيين نسبة الغرامة وأساسها بنافذة المستودع، وبعدها إعادة الترحيل.')
)
select
  e.code,
  e.sentence,
  position(e.sentence in f.prosrc) > 0 as present_expect_true
from expected e
cross join fn f
order by e.code;
