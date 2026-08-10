-- ==========================================================================
-- 077a -- CHANGE ONLY. No SELECT in this file. Verification is 077b_1 · 077b_2.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ---------------------------------------------------------------------------
-- 🔴 WHAT THIS IS: A GUARD THAT ALREADY EXISTS, DEPOSITED AND REPAIRED.
--
-- trg_refuse_archiving_stocked_storage has been live on storages for months —
-- BEFORE UPDATE FOR EACH ROW — with no script, no test, no header, and nobody
-- in this project aware of it. It was found by 074_1 only because somebody
-- happened to suspect that table that week; 076 removes the luck from the
-- question for next time.
--
-- ⚠️ AND ITS BODY CARRIES THE TWO FAULTS THAT COST TWO ROUNDS ON 068a, on a
-- guard that has been running the whole time.
--
-- ---------------------------------------------------------------------------
-- ⚠️ FIX 1 AND 2 ARE ONE STEP, NOT TWO
--
--   was:  prosecdef = false   (security invoker)
--         proconfig = null    (search_path not pinned)
--
-- invoker fails toward PERMITTING — measured on 068a: narrow the SELECT policy
-- on stock_movements one day and the balance read comes back empty, the
-- archiving passes, and the goods are stranded. That is the single state this
-- trigger exists to prevent.
--
-- ⚠️ BUT ORDER MATTERS AND IS NOT A DETAIL. Under `invoker`, an unpinned
-- search_path is the milder of the two problems. Flipping to `definer` WITHOUT
-- pinning it in the same statement opens something wider than either fault
-- alone — a definer function resolving names through a caller-influenced path.
-- So both are restated here, in one CREATE OR REPLACE, and neither ships alone.
--
-- ---------------------------------------------------------------------------
-- 🔴 FIX 3: IT RE-DERIVED THE BALANCE — the second definition 068a's header
-- forbids in words.
--
-- 068a says: "it reads product_balances, NOT stock_movements directly … a
-- trigger re-deriving it would be a second definition of 'how much is here',
-- and two definitions of one number is the fault this module has paid for more
-- than any other." The rule was written while a live violation of it sat in the
-- database, unknown to the person writing it.
--
-- ✅ AND ITS AGGREGATION WAS RIGHT — that is kept. It grouped by product and
-- tested `sum(quantity_base) <> 0`, which asks "does any product hold a live
-- balance" rather than "are there any movements". A naive EXISTS would refuse
-- archiving a storage whose movements net to zero — goods that came and went.
-- The logic was sound and only the source was wrong; product_balances computes
-- exactly that sum, so moving to it preserves the meaning and removes the
-- duplicate definition.
--
-- ---------------------------------------------------------------------------
-- 🔴 FIX 4: THE MESSAGE NAMED NEITHER THE ITEMS NOR THE WAY OUT.
--
-- It said, in effect, "this storage has stock — empty it before archiving".
-- ⚠️ "Empty it" is not an exit, it is the refusal restated. 068a — written
-- later — names the products one by one and names both routes: transfer or
-- write-off. The argument is already written in this folder: a number sends its
-- reader looking, and a list does not.
--
-- So the older guard was weaker in the dimension this project shaped
-- afterwards, and somebody archiving a storage with six products was refused
-- without being told which.
--
-- ---------------------------------------------------------------------------
-- ✅ AND ONE WORRY WAS MISPLACED, RECORDED SO IT IS NOT RAISED AGAIN: the
-- trigger has no WHEN clause, and the gate is `if old.is_active and not
-- new.is_active` — the transition alone. Renaming a stocked storage passes, and
-- un-archiving passes. Reading the body ended the question that reading the
-- trigger definition had opened.
--
-- ⚠️ AND storage_not_empty NOW NEEDS A NAMED KEY. lib/raisedCodes.test.js reads
-- docs/sql and refuses a raised code with no sentence — it caught
-- folder_still_stocked immediately. It could never have caught this one,
-- because the function was not in the repository. Depositing the script brings
-- the code under that guard for the first time; the key is added in the same
-- commit.
-- ==========================================================================

create or replace function public.refuse_archiving_stocked_storage()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_products text;
begin
  -- The transition alone. Renaming, re-pricing or un-archiving a stocked
  -- storage are all legitimate and untouched.
  if old.is_active and not new.is_active then

    -- ⚠️ product_balances — NO SECOND SUM OVER THE RAW MOVEMENTS TABLE. The view
    -- is where "how much is here" is defined, and it already applies the `<> 0`
    -- semantics the old body computed by hand: a product whose movements net to
    -- zero holds nothing and must not block archiving.
    --
    -- ⚠️ AND THE PROSE HERE DELIBERATELY DOES NOT SPELL THAT TABLE'S NAME.
    -- 077b_1 counts it in prosrc to prove the re-derivation is gone, and prosrc
    -- includes comments — so naming it here would make the check choose between
    -- catching the explanation and catching the violation. It cannot do both.
    --
    -- The needle oscillated twice before this was seen: widened until it caught
    -- a comment, narrowed until it missed an unqualified `from` (search_path is
    -- pinned, so the unqualified form works perfectly). The needle was never the
    -- problem.
    --
    -- ⇒ THE RULE: a function's prose does not name the identifier its own check
    -- forbids. Then the needle can be the bare name and catch every form of it.
    select string_agg(p.name, ' · ' order by p.name)
      into v_products
    from public.product_balances b
    join public.products p
      on p.id = b.product_id
     and p.salon_id = b.salon_id
    where b.salon_id   = old.salon_id
      and b.storage_id = old.id
      and b.balance_base <> 0;

    if v_products is not null then
      raise exception 'storage_not_empty'
        using hint = 'ما بينفع أرشفة هذا المستودع وفيه بضاعة. نقل البضاعة لمستودع تاني أو شطبها، وبعدها الأرشفة. الأصناف اللي لسّه فيها رصيد: ' || v_products;
    end if;
  end if;

  return new;
end;
$function$;

-- Re-created so the trigger and the function are one deposited unit rather than
-- a function whose attachment lives only in the database.
drop trigger if exists trg_refuse_archiving_stocked_storage on public.storages;

create trigger trg_refuse_archiving_stocked_storage
  before update on public.storages
  for each row
  execute function public.refuse_archiving_stocked_storage();

comment on function public.refuse_archiving_stocked_storage() is
  'بيرفض أرشفة مستودع لسّه فيه رصيد. السبب إن الأرشفة بتشيله من المنتقي فبتختفي كل منتجاته من كل شاشة وبتضلّ حركاتها مكانها، والنقل ما بينقذها لأن المستودع نفسه ما عاد ينُختار. الرفض بيسمّي الأصناف والمخرج، والأرشفة بترجع مشروعة بعد التفريغ. وبيمسك الانتقال وحده، فإعادة التسمية وإلغاء الأرشفة بيمرقوا.';
