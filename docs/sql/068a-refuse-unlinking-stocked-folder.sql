-- ==========================================================================
-- 068a -- CHANGE ONLY. No SELECT in this file. Verification is 068b_1 … 068b_3.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- ⚠️ RUN IT BEFORE THE STORAGE WINDOW IS BUILT, not after.
--
-- ---------------------------------------------------------------------------
-- THE HOLE THIS CLOSES, AND WHY ITS COST DOUBLES AFTER FIRST USE
--
-- storage_categories_delete is the plain salon predicate, so nothing refuses
-- removing folder F from storage S while S still holds stock of F's products.
--
-- Today the hole is invisible: the seed linked everything to everything, so no
-- link has been removed yet. ⚠️ THE FIRST UN-TICK CREATES IT. F leaves S, its
-- products vanish from S's tree, AND THEIR MOVEMENTS IN S REMAIN. S now holds a
-- balance nobody can see.
--
-- ⚠️ AND TRANSFER CANNOT RESCUE IT. A transfer needs a folder in common, and F
-- is no longer in S — that filter falls out of the same junction table. So the
-- goods are stranded with no route out: not on any screen, not reachable from
-- another storage, and the shortage surfaces only in a stocktake of a storage
-- that does not list the item.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHY THE DATABASE AND NOT ONLY THE SCREEN — AND WHY BOTH
--
-- The screen guard is cheaper and gives the better sentence. It is also
-- dissolved by the first call that does not go through the screen, and
-- CLAUDE.md already says so: a guard in the interface is undone by the first
-- call from somewhere else.
--
-- ⚠️ It cannot be a CHECK: the rule is not about one row's validity, it is a
-- relationship between a storage_categories row and rows in stock_movements. So
-- a trigger is the only structural form available.
--
-- AND THE SCREEN SAYS IT TOO, which is not duplication — it is the precedent
-- this project already set for storages_owner_matches_kind_check, written in
-- lib/storageForm.js: "Saying it here first is the difference between a
-- sentence beside the field and a CHECK violation in Postgres English — the
-- database still refuses either way, which is the point of saying it twice."
--
-- ---------------------------------------------------------------------------
-- ⚠️ THE REFUSAL NAMES THE WAY OUT, WHICH IS THE WHOLE DESIGN
--
-- Not a warning before the click — a refusal that says what to do instead. Same
-- shape as fine_policy_missing, which was the first guard in this module to
-- name its own remedy and is the reason that pattern is now the house style.
--
-- And the action stays perfectly legitimate once the shelf is empty. That is
-- the real-world order anyway: you move the goods out, THEN you say the item is
-- no longer kept here. The rule does not forbid the intent, it forbids doing it
-- in the wrong order.
--
-- ⚠️ AND IT READS product_balances, NOT stock_movements DIRECTLY. The balance is
-- the sum of movements and the view already says so with security_invoker; a
-- trigger re-deriving it would be a second definition of "how much is here",
-- and two definitions of one number is the fault this module has paid for more
-- than any other.
-- ==========================================================================

create or replace function public.refuse_unlinking_stocked_folder()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_products text;
begin
  -- The products of the folder being unlinked that still have a balance in the
  -- storage being unlinked from. Named, not counted: the message has to tell
  -- the person which shelf to clear, and a number would send them looking.
  select string_agg(p.name, ' · ' order by p.name)
    into v_products
  from public.product_balances b
  join public.products p
    on p.id = b.product_id
   and p.salon_id = b.salon_id
  where b.salon_id   = old.salon_id
    and b.storage_id = old.storage_id
    and p.category_id = old.category_id
    and b.balance_base <> 0;

  if v_products is not null then
    raise exception 'folder_still_stocked'
      using hint = 'ما بينفع تشيل هذا المجلّد من المستودع وفيه بضاعة منه. نقل البضاعة لمستودع تاني أو شطبها، وبعدها إزالة التأشير. الأصناف اللي لسّه فيها رصيد: ' || v_products;
  end if;

  return old;
end;
$function$;

drop trigger if exists refuse_unlinking_stocked_folder on public.storage_categories;

create trigger refuse_unlinking_stocked_folder
  before delete on public.storage_categories
  for each row
  execute function public.refuse_unlinking_stocked_folder();

comment on function public.refuse_unlinking_stocked_folder() is
  'بيرفض إزالة مجلّد من مستودع لسّه فيه رصيد من منتجات هذا المجلّد. السبب إن الإزالة بتخفي المنتجات من شجرة المستودع وبتترك حركاتها مكانها، فبيصير رصيد ما حدا بيشوفه — والنقل ما بينقذه لأنه بدّه مجلّدًا مشتركًا وهو انشال. الرفض بيسمّي الأصناف والمخرج، والفعل بيرجع مشروعًا بعد تفريغ الرفّ.';
