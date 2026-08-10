-- ==========================================================================
-- 079a -- CHANGE ONLY. No SELECT in this file. Verification is 079b_1 · 079b_2.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- ⚠️ RUN IT BEFORE ANY SCREEN THAT EDITS A PRODUCT SHIPS.
--
-- ⚠️ REPLACES THE REJECTED DRAFT 079a-rewrite-consignment-freeze.sql, WHICH IS
-- DELETED. Three things changed. The draft's first point survived review; its
-- second was rejected for widening too far, and its third omission was caught.
--
-- ---------------------------------------------------------------------------
-- WHAT THE LIVE FUNCTION DOES (found by 076, read by 078, no script, no test):
--
--     if (new.is_consignment is distinct from old.is_consignment
--         or new.supplier_id  is distinct from old.supplier_id)
--        and exists (select 1 from stock_movements where product_id = new.id)
--
-- One condition for two fields, and `exists` for a balance.
--
-- ---------------------------------------------------------------------------
-- ✅ KEPT FROM THE DRAFT — supplier_id must not be frozen on an ordinary
-- product.
--
-- ⚠️ AND THE REASON IS MEASURED, NOT ARGUED. Review's case was "history lives
-- in the documents, and every movement carries its document, and the document
-- carries its supplier". That is checkable and it checks out:
--
--     stock_documents … storage_id, supplier_id, employee_id, …
--       ← 049a:65, 050c:60, 051b:82 — the posting function's own insert list
--
-- So the supplier of each receipt is recorded per document. The column on
-- products is a default for the next one, not the record of the last one.
--
-- ⚠️ BUT THE PRACTICAL GAIN IS SMALLER THAN THE DRAFT CLAIMED, AND SAYING SO
-- IS THE POINT. The draft wrote "a wrong pick becomes permanent". It is not
-- reachable from the product window at all: ProductFormDialog.js:403 renders
-- the supplier field only `{isConsignment && …}`, so an ordinary product has
-- no supplier control on screen. The lock was still wrong — it refuses writes
-- from every other route, and it refuses them for a reason that does not hold
-- — but it was not blocking a correction path anybody could reach by clicking.
--
-- ---------------------------------------------------------------------------
-- 🔴 CORRECTED — TWO FIELDS, TWO TESTS. The draft gave both the live-balance
-- test, and for is_consignment that is the wrong question.
--
-- Review's counter-example, and it holds: a consignment product receives 100
-- and sells all 100. Balance is zero and the history is entirely intact — a
-- hundred sales of somebody else's goods, and the depositor is owed for them.
-- Under the draft, zero balance unlocks the flag, it flips to "not
-- consignment", and every one of those hundred movements is now read as our
-- own stock. The depositor's claim leaves the data model.
--
-- ⚠️ AND THE ASYMMETRY IS MEASURABLE, WHICH IS WHY IT IS NOT A MATTER OF
-- TASTE. The two fields differ in exactly one respect: whether the documents
-- carry a copy.
--
--     supplier_id      → recorded on every stock_documents row
--     is_consignment   → appears in NO script in docs/sql, and in no insert
--                        list of the four posting functions
--
-- So flipping the supplier changes a default; flipping the flag rewrites the
-- only record there is. One protects CURRENT OWNERSHIP and asks "is there
-- stock here now". The other protects HISTORY and asks "did anything real
-- ever happen".
--
--     is_consignment  ⇒ any live movement          ← history
--     supplier_id     ⇒ a live balance             ← current ownership
--
-- ⚠️ AND THAT SECOND ROW IS AN INFERENCE, NOT A MEASUREMENT — deliberately.
-- The column lists above come from the FUNCTION TEXTS, and DATABASE_DIAGRAM.md
-- says the limit out loud at line 576: a function's text reveals the columns it
-- TOUCHES, not the table's columns. So "stock_documents has no is_consignment"
-- is the strongest thing this file could read, and it is not proof.
--
-- ⇒ 079b_1 asks the catalogue for the whole column list of both tables and it
-- is the FIRST question there, because the entire split rests on it. If
-- stock_documents turns out to carry a consignment flag, the flag is mirrored
-- too, this file's TEST ONE is over-strict, and it comes back here.
--
-- ---------------------------------------------------------------------------
-- 🔴 CORRECTED — security definer. The draft left it invoker, on a guard with
-- the same shape as the one converted an hour earlier in 077a.
--
-- It reads product_balances and stock_movements with the CALLER's rights, so
-- the day a SELECT policy narrows, the sums come back zero and the change is
-- ALLOWED — the one case the guard exists to refuse. `invoker` fails toward
-- permission. Both reads are salon-filtered (`= new.salon_id`), which is the
-- objection that was raised against definer on the other guard and did not
-- hold there either.
--
-- ---------------------------------------------------------------------------
-- 🔴 CORRECTED — "a live document" is a VIEW, not a third definition inside a
-- function.
--
-- This is the 069a situation exactly: a concept about to be written into a
-- guard that the documents list, the reports and the next guard all need. 069a
-- was written because one walk had already drifted between two copies inside a
-- single round.
--
-- ⚠️ AND IT CARRIES A BOOLEAN RATHER THAN FILTERING, WHICH IS THE ONE DESIGN
-- CHOICE HERE THAT WAS NOT OBVIOUS. A filtering view (`live_stock_documents`)
-- would serve the guards and the reports and would NOT serve the documents
-- list — which must keep showing reversals and reversed documents, because
-- this project decided that on purpose (ADR-051: "the two documents stay
-- visible; history says a mistake happened and was corrected, not that it
-- never happened"). A filter would have sent the list to re-derive the
-- condition itself, which is the third copy arriving by another door.
--
-- ⚠️ AND ONE COUPLING IS NAMED BECAUSE IT IS INVISIBLE: the left join cannot
-- fan out only because 045 put a UNIQUE index on stock_documents
-- (reverses_document_id), single column. Drop that index and this view starts
-- returning a document twice with no error anywhere.
-- ==========================================================================

create or replace view public.stock_document_liveness
  with (security_invoker = true)
as
select
  d.id                 as document_id,
  d.salon_id,
  d.reverses_document_id,
  r.id                 as reversed_by_document_id,
  -- Live = it is not itself a reversal, and nothing reversed it. Both halves
  -- are needed: reversing a document retires the PAIR, not one of them.
  (d.reverses_document_id is null and r.id is null) as is_live
from public.stock_documents d
left join public.stock_documents r
  on  r.reverses_document_id = d.id
  and r.salon_id             = d.salon_id;

comment on view public.stock_document_liveness is
  'لكل مستند: هل هو حيّ — يعني لا هو عكسٌ لغيره ولا حدا عكسه. انوجد لأن نفس السؤال كان رح ينكتب بحارس وبقائمة المستندات وبالتقارير، ونفس الصنف انحرف قبل هيك بين نسختين بجولة وحدة. وبيحمل الجواب عمودًا لا بيصفّي صفوفًا، لأن قائمة المستندات لازم تضلّ تعرض المعكوس وعاكسه.';

-- ---------------------------------------------------------------------------
-- The trigger function, rewritten whole.
--
-- ⚠️ security definer and set search_path are stated here and not inherited:
-- CREATE OR REPLACE rewrites the function entirely, and a version that quietly
-- lost either would keep working and stop being the thing 079b_1 measured.
-- ---------------------------------------------------------------------------
create or replace function public.freeze_consignment_after_use()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_moved   boolean;
  v_balance numeric;
begin
  -- ── TEST ONE — the consignment flag, against HISTORY ────────────────────
  -- Nothing but this column records that the goods belonged to somebody else.
  -- Flipping it after real movement re-reads every past movement as our own
  -- stock, so the question is "did anything real ever happen", not "is there
  -- anything here now". A product that received 100 on consignment and sold
  -- all 100 has a balance of zero and a history that must not be rewritten.
  --
  -- ⚠️ coalesce on BOTH sides rather than `is distinct from` on the raw
  -- columns: if the column turns out to accept null, a null→false update
  -- carries no change in meaning and must not be refused. 079b_1 measures the
  -- nullability; if it comes back NOT NULL this is dead code kept as
  -- insurance, exactly like nullif(units_per_package, 0) in 056c.
  if coalesce(new.is_consignment, false) is distinct from coalesce(old.is_consignment, false)
  then
    select exists (
      select 1
      from public.stock_movements m
      join public.stock_document_liveness l
        on  l.document_id = m.document_id
        and l.salon_id    = m.salon_id
      where m.product_id = new.id
        and m.salon_id   = new.salon_id
        and l.is_live
    ) into v_moved;

    if v_moved then
      raise exception 'consignment_flag_locked'
        using hint = 'ما بينفع تغيير خانة «منتج أمانة» على منتج تحرّك فعلًا. الحركات السابقة كلها انحسبت على أساس مين صاحب البضاعة، وتغيير الخانة هلأ بيعيد قراءتها بالمقلوب. ولو الخانة انكتبت غلط من البداية: إنشاء منتج جديد بالحالة الصحيحة وأرشفة هذا.';
    end if;
  end if;

  -- ── TEST TWO — the supplier, against CURRENT OWNERSHIP ──────────────────
  -- Frozen only while the product IS consignment, because there the supplier
  -- is the owner of the goods sitting in the storage. On an ordinary product
  -- it is a default for the next receipt, and each receipt already recorded
  -- its own supplier on its document.
  --
  -- ⚠️ A LIVE balance, not "has anything ever happened". A supply entered
  -- wrongly and then REVERSED leaves the product untouched in every accounting
  -- sense — and «شامبو 250 مل» and «مقشر ليزر» are both locked in this
  -- database today by that correction working exactly as designed.
  if coalesce(old.is_consignment, false)
     and new.supplier_id is distinct from old.supplier_id
  then
    select coalesce(sum(b.balance_base), 0)
      into v_balance
    from public.product_balances b
    where b.product_id = new.id
      and b.salon_id   = new.salon_id;

    if v_balance <> 0 then
      raise exception 'consignment_supplier_locked'
        using hint = 'ما بينفع تبديل المورّد وهذا منتج أمانة لسّه إله رصيد — البضاعة الموجودة ملك المورّد الحالي. تفريغ الرصيد أولًا (نقل أو شطب أو إرجاع للمورّد)، وبعدها التبديل بيصير مسموح.';
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
  'حارسان بدالّة وحدة، وكل واحد إله سؤاله. خانة الأمانة بتنقفل لو صار على المنتج أي حركة حيّة — لأن ما في غير هالخانة بيسجّل إن البضاعة كانت لحدا تاني، فقلبُها بيعيد قراءة كل حركة سابقة. والمورّد بينقفل بس وهو أمانة وإله رصيد حيّ — لأن المورّد وقتها صاحب البضاعة الموجودة، وبالمنتج العاديّ هو افتراضٌ للتوريد الجاي لا سجلٌّ للماضي (كل مستند بيحمل مورّده). والحركة الحيّة بتنقرأ من منظور stock_document_liveness، فتوريدٌ انعكس ما بيقفل شي.';
