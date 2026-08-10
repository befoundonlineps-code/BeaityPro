-- ==========================================================================
-- 069b · QUERY 1 of 2 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 069a.
--
-- ---------------------------------------------------------------------------
-- WHY: three things CREATE OR REPLACE resets without saying so.
--
--   1. the view's security_invoker — reloptions, read not assumed. Its absence
--      means the view runs with its OWNER's rights and every salon sees every
--      salon's folders. ⚠️ Invisible while one salon exists.
--   2. the function is still definer and still pinned to search_path=public
--      after being rewritten by 069a.
--   3. the function's body now READS THE VIEW. Counting the fragment is what
--      distinguishes "069a ran" from "069a was pasted but the older body is
--      still deployed" — `where proname =` cannot tell those apart.
--
--   4. the Arabic on BOTH objects, read back out of the database. 069a deposits
--      a sentence on the view and rewrites the function; nothing was reading
--      either. ⚠️ And 068b_2 verified the function's comment BEFORE 069a
--      rewrote it — a check that ran before the last change describes the state
--      before it. Both readings are absorbed here so no ordering has to be
--      remembered.
--
-- EXPECTED:
--   view_options_expect_invoker             {security_invoker=true}
--   is_security_definer_expect_true         true
--   settings_expect_search_path             {search_path=public}
--   body_reads_view_expect_1                1
--   body_has_own_walk_expect_0              0
--   view_comment_expect_true                true
--   function_comment_expect_true            true
--   hint_expect_true                        true
-- ==========================================================================

select
  (select cl.reloptions
     from pg_class cl
     join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
      and cl.relname = 'product_category_descendants')      as view_options_expect_invoker,

  p.prosecdef                                               as is_security_definer_expect_true,
  p.proconfig                                               as settings_expect_search_path,

  -- ⚠️ The needle is the JOIN, punctuation and all — not the view's bare name,
  -- which also appears in this function's comments and would count them.
  (length(p.prosrc) - length(replace(p.prosrc, 'join public.product_category_descendants d', '')))
    / length('join public.product_category_descendants d')  as body_reads_view_expect_1,

  -- ⚠️ AND THE OLD WALK MUST BE GONE, not merely joined beside. A body carrying
  -- both would pass the count above while still computing its own closure —
  -- which is the exact drift 069a exists to make impossible.
  --
  -- ⚠️ The needle is `with recursive` ALONE. It was 'with recursive descendants'
  -- — the previous wording, exactly — so a walk rewritten under any other name
  -- (`with recursive sub`) counted zero and read as clean. The header claimed
  -- "no walk of its own"; the needle only ever asked "not that one". Narrowed
  -- to nothing, which is what the sentence above says.
  (length(p.prosrc) - length(replace(p.prosrc, 'with recursive', '')))
    / length('with recursive')                              as body_has_own_walk_expect_0,

  -- ⚠️ THE ARABIC ON THE VIEW, READ BACK HERE — 069a deposits a full sentence
  -- into the database and nothing was reading it. comment on view is not a code
  -- comment: it leaves the repository and is read with database tooling, which
  -- is why 046 exists as its own script. The rule has 066c_5 and 068b_2 behind
  -- it, and the round that created the view as the single source of the walk
  -- was the round that skipped it.
  coalesce(
    (select obj_description(cl.oid, 'pg_class')
       from pg_class cl
       join pg_namespace vn on vn.oid = cl.relnamespace
      where vn.nspname = 'public'
        and cl.relname = 'product_category_descendants')
    = 'كل مجلّد مع نفسه ومع كل المجلّدات تحته، بأي عمق. انوجد لأن نفس المشي كان مكتوبًا بمكانين وانحرف بينهم بجولة وحدة، وكان رح ينكتب ثالثًا بالشاشة. المُشغّل والتحقّق والشاشة بيقرأوه كلهم، فالمطابقة صارت بنيويّة لا متابَعة.',
    false
  )                                                          as view_comment_expect_true,

  -- ⚠️ AND THE FUNCTION'S OWN COMMENT, which 068b_2 verified BEFORE 069a
  -- rewrote the function. CREATE OR REPLACE keeps the OID so the comment
  -- survives — an assumption, and 068b_2's green result describes the previous
  -- version. Absorbed here so no ordering has to be remembered.
  --
  -- ⚠️ COMPARED WHOLE, not by a prefix. A first version of this line used
  -- position() on six words from the start, while the view's comment beside it
  -- was compared entire — two standards for one rule inside one query, and the
  -- stricter of them was the one 068b_2 already had (f.description = e.sentence).
  -- So the replacement was weaker than what it replaced, in the rule that says
  -- "not whether it contains Arabic characters". A comment with its tail cut —
  -- the clause that names the way out — would have passed.
  coalesce(
    obj_description(p.oid, 'pg_proc')
    = 'بيرفض إزالة مجلّد من مستودع لسّه فيه رصيد من منتجات هذا المجلّد. السبب إن الإزالة بتخفي المنتجات من شجرة المستودع وبتترك حركاتها مكانها، فبيصير رصيد ما حدا بيشوفه — والنقل ما بينقذه لأنه بدّه مجلّدًا مشتركًا وهو انشال. الرفض بيسمّي الأصناف والمخرج، والفعل بيرجع مشروعًا بعد تفريغ الرفّ.',
    false
  )                                                          as function_comment_expect_true,

  -- 🔴 AND THE HINT — THE READ THAT WAS DROPPED, AND THE ONLY ONE THAT WAS
  -- RETYPED BY HAND.
  --
  -- 068b_2 checked two things: the comment and the sentence inside the body.
  -- Absorbing only the comment left the hint unread anywhere after 069a, and
  -- 068b_2 left the run order.
  --
  -- ⚠️ The one dropped is the worse of the two, by the argument written into
  -- this very file: the COMMENT survived untouched because CREATE OR REPLACE
  -- keeps the OID — nobody retyped it. The HINT was reprinted character by
  -- character inside 069a's new body. So the thing that survived by itself is
  -- checked and the thing copied by hand is not, and one lost character passes
  -- in silence. That is what 046 and 066c_5 exist for.
  --
  -- Fixed part only: the sentence ends with a runtime list of product names.
  coalesce(
    position(
      'ما بينفع تشيل هذا المجلّد من المستودع وفيه بضاعة منه. نقل البضاعة لمستودع تاني أو شطبها، وبعدها إزالة التأشير. الأصناف اللي لسّه فيها رصيد: '
      in p.prosrc
    ) > 0,
    false
  )                                                          as hint_expect_true
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'refuse_unlinking_stocked_folder';
