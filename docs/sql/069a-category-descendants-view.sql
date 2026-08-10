-- ==========================================================================
-- 069a -- CHANGE ONLY. No SELECT in this file. Verification is 069b_1 · 069b_2.
--
-- PREPARED, NOT RUN BY ME. The owner executes it, AFTER 068a.
--
-- ---------------------------------------------------------------------------
-- ONE WALK, DEPOSITED ONCE — BECAUSE THE THIRD COPY WAS ABOUT TO BE WRITTEN
--
-- The descendant walk now exists twice: inside refuse_unlinking_stocked_folder
-- and inside 068b_3. And 068a obliges the storage window to name the blocking
-- products itself — because dbErrorSentence prefers the named key and drops the
-- hint — so a third copy was going to be written into the screen.
--
-- ⚠️ IT ALREADY DRIFTED ONCE BETWEEN TWO COPIES INSIDE A SINGLE ROUND. 068a was
-- corrected to walk descendants and 068b_3 stayed on the direct folder, so the
-- dry run computed a different condition from the guard it exists to preview.
-- Three copies will not last longer than two did.
--
-- ⚠️ AND THE DRIFT COSTS MORE IN THE SCREEN THAN IT DID IN THE DRY RUN. The
-- window would say "move these products", the person moves them, and the
-- deletion is refused again — because the blocking product sat in a subfolder
-- the message never mentioned. A refusal that names the way out and then does
-- not open it is worse than a silent one.
--
-- So the walk becomes a view, and the trigger, 068b_3 and the screen all read
-- it. Matching stops being something to keep up and becomes structural: there
-- is nothing left mirroring anything.
--
-- > This is the same choice 068a already made about the balance — it reads
-- > product_balances rather than re-deriving a sum, because two definitions of
-- > one number is the fault this module has paid for most. Three definitions of
-- > one walk is that fault wearing different clothes.
--
-- ---------------------------------------------------------------------------
-- ⚠️ security_invoker = true, WRITTEN EXPLICITLY — CLAUDE.md item 6.
--
-- create or replace view without WITH resets options to their defaults, and the
-- costs are not symmetric: an unnecessary line versus a view that runs with its
-- owner's rights and shows every salon's folders to every salon. That failure
-- is invisible while one salon exists, which is exactly now.
--
-- ⚠️ And inside refuse_unlinking_stocked_folder — a definer function — an
-- invoker view is evaluated with the FUNCTION OWNER's rights, which is the
-- dependency 068b_1 measures (owner_bypasses_rls). Unchanged by this file: the
-- view inherits the arrangement the trigger already had with product_balances.
--
-- ⚠️ `union` NOT `union all`: a cycle in parent_id makes union all run forever,
-- and here that would hang the delete instead of refusing it. Nothing is known
-- to prevent a cycle, and that is the argument — union costs nothing.
-- ==========================================================================

create or replace view public.product_category_descendants
  with (security_invoker = true)
as
with recursive closure as (
  -- A folder is its own descendant. That is what makes the caller's join a
  -- single condition instead of "the folder OR anything under it" written out
  -- at every call site — which is where the direct-folder version came from.
  select c.id as root_id, c.id as node_id, c.salon_id
  from public.product_categories c
  union
  select cl.root_id, child.id, child.salon_id
  from public.product_categories child
  join closure cl
    on child.parent_id = cl.node_id
   and child.salon_id  = cl.salon_id
)
select root_id, node_id, salon_id
from closure;

comment on view public.product_category_descendants is
  'كل مجلّد مع نفسه ومع كل المجلّدات تحته، بأي عمق. انوجد لأن نفس المشي كان مكتوبًا بمكانين وانحرف بينهم بجولة وحدة، وكان رح ينكتب ثالثًا بالشاشة. المُشغّل والتحقّق والشاشة بيقرأوه كلهم، فالمطابقة صارت بنيويّة لا متابَعة.';

-- The trigger re-created to read the view. Its body is otherwise unchanged —
-- same salon filter, same product_balances read, same message.
--
-- ⚠️ security definer and set search_path are RESTATED, not inherited. CREATE OR
-- REPLACE rewrites the function whole; a version that lost either would keep
-- working and stop being the thing 068b_1 measured.
create or replace function public.refuse_unlinking_stocked_folder()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_products text;
begin
  select string_agg(p.name, ' · ' order by p.name)
    into v_products
  from public.product_balances b
  join public.products p
    on p.id = b.product_id
   and p.salon_id = b.salon_id
  join public.product_category_descendants d
    on d.node_id  = p.category_id
   and d.salon_id = p.salon_id
  where d.root_id    = old.category_id
    and b.salon_id   = old.salon_id
    and b.storage_id = old.storage_id
    and b.balance_base <> 0;

  if v_products is not null then
    raise exception 'folder_still_stocked'
      using hint = 'ما بينفع تشيل هذا المجلّد من المستودع وفيه بضاعة منه. نقل البضاعة لمستودع تاني أو شطبها، وبعدها إزالة التأشير. الأصناف اللي لسّه فيها رصيد: ' || v_products;
  end if;

  return old;
end;
$function$;
