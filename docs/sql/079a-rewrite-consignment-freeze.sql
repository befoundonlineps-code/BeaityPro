-- ==========================================================================
-- 079a -- CHANGE ONLY. No SELECT in this file. Verification is 079b_1 · 079b_2.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- ⚠️ RUN IT BEFORE ANY SCREEN THAT EDITS A PRODUCT SHIPS.
--
-- ---------------------------------------------------------------------------
-- 🔴 THE SECOND UNDOCUMENTED GUARD, AND THIS ONE IS WRONG IN THREE WAYS.
--
-- freeze_consignment_after_use has been live on products with no script, no
-- test, no comment. It was found by 076 and read by 078. Its name says it
-- freezes something about consignment; what it does is wider.
--
--     if (new.is_consignment is distinct from old.is_consignment
--         or new.supplier_id  is distinct from old.supplier_id)
--        and exists (select 1 from stock_movements where product_id = new.id)
--
-- ---------------------------------------------------------------------------
-- ⚠️ FAULT 1 — IT LOCKS supplier_id ON EVERY PRODUCT, CONSIGNMENT OR NOT.
--
-- An ordinary product supplied once can never have its supplier corrected. A
-- wrong pick becomes permanent, and the message names no way out because there
-- is none — it is not "do this first", it is "never again".
--
-- ✅ Freezing is_consignment IS justified and is kept: flipping it after a
-- movement rewrites who owned the goods, retroactively.
-- ✅ And freezing supplier_id is justified TOO — but only on a consignment
-- product, where the supplier IS the owner of the stock. On an ordinary product
-- it is a descriptive field, and the CHECK "no consignment without a supplier"
-- is what ties the two together in the first place.
--
-- So the condition becomes: the consignment flag, always; the supplier, only
-- while the product is consignment.
--
-- ---------------------------------------------------------------------------
-- 🔴 FAULT 2 — `exists` OVER MOVEMENTS, NOT A LIVE BALANCE.
--
-- Any movement locks it, including one that was reversed. ⚠️ So a supply
-- entered by mistake and then REVERSED — the honest correction path this
-- project spent rounds deciding on — leaves the product frozen forever. The
-- product has not moved in any accounting sense and it is locked.
--
-- ⚠️ AND IT IS ALREADY TRUE IN THIS DATABASE: «شامبو 250 مل» and «مقشر ليزر»
-- both had their supply reversed. Two products are locked today by a correction
-- working exactly as designed.
--
-- ✅ Its sibling gets this right: refuse_archiving_stocked_storage uses
-- `sum(...) <> 0` — "is there a live balance" rather than "did anything ever
-- happen". Same concept, two functions, and the correct one is in the other.
-- So this reads product_balances, where that sum is already defined.
--
-- ---------------------------------------------------------------------------
-- ✅ NOT A FAULT — consignment_locked ALREADY HAS A SENTENCE AND A TEST.
--
-- Review expected this code to be outside the message guard, reasoning that its
-- function is not in the repository. ⚠️ It is not: lib/raisedCodes.js:181 maps
-- it to products:productDialog.consignmentLockedError, and
-- raisedCodes.test.js:109 asserts that sentence by name. Somebody added it by
-- hand without the function ever being deposited.
--
-- ⚠️ SO THE REAL GAP IS THE OPPOSITE ONE, AND ONLY VISIBLE AFTER LOOKING: the
-- two sentences on screen describe the behaviour THIS FILE REPLACES.
--
--   consignmentLockedError  «صار عليه حركة مخزون … بعد أول حركة»
--   consignmentHint          «وما بينتغيّر بعد أول حركة عليه»
--
-- Both say "after the first movement" and both say the supplier is frozen
-- unconditionally — which is exactly what is being corrected. Left alone they
-- would become two screens explaining a rule the database no longer applies.
-- Rewritten in the same commit.
--
-- ⚠️ And the lesson is the one this thread keeps paying for, this time on our
-- side: a claim about the repository was acted on before the repository was
-- read, and the correction landed as a duplicate map entry pointing at a key
-- that does not exist. Checking is what turned a wrong fix into the right one.
--
-- ⚠️ And `set search_path` is pinned here, which it was not before.
-- ==========================================================================

create or replace function public.freeze_consignment_after_use()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_balance numeric;
begin
  -- The consignment flag is frozen once the goods have moved, always. Changing
  -- the supplier is frozen only while the product IS consignment, because there
  -- the supplier is the owner of the stock rather than a description of where
  -- it was bought.
  if (new.is_consignment is distinct from old.is_consignment)
     or (old.is_consignment and new.supplier_id is distinct from old.supplier_id)
  then
    -- ⚠️ A LIVE balance, not "has anything ever happened". A supply that was
    -- entered wrongly and then reversed leaves the product untouched in every
    -- accounting sense, and must not leave it frozen — the correction path this
    -- project chose deliberately must not create a permanent lock.
    select coalesce(sum(b.balance_base), 0)
      into v_balance
    from public.product_balances b
    where b.product_id = new.id
      and b.salon_id   = new.salon_id;

    if v_balance <> 0 then
      raise exception 'consignment_locked'
        using hint = 'ما بينفع تغيير حالة الأمانة أو المورّد وهذا المنتج لسّه إله رصيد. تفريغ رصيده أولًا — نقل أو شطب أو إرجاع للمورّد — وبعدها التعديل بيصير مسموح.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists freeze_consignment_after_use on public.products;

create trigger freeze_consignment_after_use
  before update on public.products
  for each row
  execute function public.freeze_consignment_after_use();

comment on function public.freeze_consignment_after_use() is
  'بيمنع تغيير حالة الأمانة وهذا المنتج إله رصيد، وبيمنع تغيير المورّد كمان لو كان أمانة — لأن المورّد وقتها صاحب البضاعة لا وصفًا لمصدرها. وبيسمح بتغيير المورّد على منتج عاديّ لأنه حقلٌ وصفيّ وقفلُه بيخلّي غلطة اختيارٍ نهائيّة. وبيقيس الرصيد الحيّ لا مجرّد وجود حركة، فتوريدٌ انعكس ما بيقفل شي.';
