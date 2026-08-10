-- ==========================================================================
-- 077b · QUERY 1 of 2 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN AFTER 077a.
--
-- ---------------------------------------------------------------------------
-- WHY: the two security properties, together, and the source of the balance.
--
-- EXPECTED:
--   is_security_definer_expect_true   true
--   settings_expect_search_path       {search_path=public}
--   reads_view_expect_1               1
--   rederives_balance_expect_0        0
--   gate_on_transition_expect_1       1
--   hint_expect_true                  true
--   function_comment_expect_true      true
--   trigger_count_expect_1            1
--
-- ⚠️ BOTH SECURITY LINES ARE READ, NOT ONE. They were fixed in a single
-- statement because flipping to definer without pinning search_path is worse
-- than leaving both alone, so a result showing one without the other is the
-- state this file exists to refuse — not a partial success.
--
-- ⚠️ AND rederives_balance_expect_0 IS THE ONE THAT WOULD PASS WHILE WRONG if
-- it were left out. A body that reads product_balances AND still carries its
-- own sum over stock_movements satisfies reads_view_expect_1 while keeping the
-- second definition of "how much is here" — which is the whole reason this
-- rewrite exists. Same shape as 069b_1's body_has_own_walk_expect_0.
-- ==========================================================================

select
  p.prosecdef                                 as is_security_definer_expect_true,
  p.proconfig                                 as settings_expect_search_path,

  (length(p.prosrc) - length(replace(p.prosrc, 'from public.product_balances b', '')))
    / length('from public.product_balances b')          as reads_view_expect_1,

  -- ⚠️ The old source must be GONE, not merely joined beside.
  --
  -- ⚠️ AND THE NEEDLE IS THE FROM CLAUSE, NOT THE BARE NAME. A first version
  -- counted 'stock_movements', which appears in a COMMENT inside the body —
  -- «product_balances, not a second sum over stock_movements» — so it would
  -- have returned 1 and read as a failure on a function that was fixed
  -- correctly. prosrc is the body with its comments; only the file header sits
  -- outside $function$.
  --
  -- ⚠️ And the repair that leaps to mind is the dangerous one: delete the
  -- comment — the sentence explaining WHY the view is read — to satisfy a
  -- counter looking for a word instead of a use.
  --
  -- 069b_1's header said this one round ago, from the opposite side: "the
  -- needle is the JOIN, punctuation and all — not the view's bare name, which
  -- also appears in this function's comments and would count them." Same trap,
  -- mirrored, one round later.
  (length(p.prosrc) - length(replace(p.prosrc, 'from public.stock_movements', '')))
    / length('from public.stock_movements')              as rederives_balance_expect_0,

  -- The gate is the transition alone: renaming and un-archiving must still pass.
  (length(p.prosrc) - length(replace(p.prosrc, 'if old.is_active and not new.is_active', '')))
    / length('if old.is_active and not new.is_active')   as gate_on_transition_expect_1,

  coalesce(
    position(
      'ما بينفع أرشفة هذا المستودع وفيه بضاعة. نقل البضاعة لمستودع تاني أو شطبها، وبعدها الأرشفة. الأصناف اللي لسّه فيها رصيد: '
      in p.prosrc
    ) > 0,
    false
  )                                           as hint_expect_true,

  coalesce(
    obj_description(p.oid, 'pg_proc')
    = 'بيرفض أرشفة مستودع لسّه فيه رصيد. السبب إن الأرشفة بتشيله من المنتقي فبتختفي كل منتجاته من كل شاشة وبتضلّ حركاتها مكانها، والنقل ما بينقذها لأن المستودع نفسه ما عاد ينُختار. الرفض بيسمّي الأصناف والمخرج، والأرشفة بترجع مشروعة بعد التفريغ. وبيمسك الانتقال وحده، فإعادة التسمية وإلغاء الأرشفة بيمرقوا.',
    false
  )                                           as function_comment_expect_true,

  -- ⚠️ One trigger, not two. `drop trigger if exists` then `create` is what
  -- keeps a re-run from leaving a second attachment behind under another name.
  (select count(*) from pg_trigger t
    where t.tgfoid = p.oid and not t.tgisinternal)       as trigger_count_expect_1
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'refuse_archiving_stocked_storage';
