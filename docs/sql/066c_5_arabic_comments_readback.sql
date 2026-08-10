-- ==========================================================================
-- 066c · QUERY 5 of 6 -- VERIFICATION ONLY. Read-only: nothing is written.
--
-- RUN ORDER: 066a -> 066b -> 066c_1 … 066c_6. RUN AFTER 066a.
--
-- ---------------------------------------------------------------------------
-- WHY: 066a deposits three Arabic descriptions into the database, and this is
-- where the project's rule is discharged — anything shipped to a place we
-- cannot see is read back from it.
--
-- ⚠️ NOT "does it contain Arabic characters". 048 measured eighteen messages
-- that were perfectly valid Arabic-shaped text and were all the wrong text. The
-- sentences are typed here and compared character for character.
--
-- ⚠️ AND comment on table/column IS NOT A CODE COMMENT. It leaves the database
-- and is read by anyone using database tooling, which is why 046 exists as its
-- own script: a wrong description shipped to the database becomes part of the
-- behaviour it describes.
--
-- ⚠️ WHY IT IS HERE AND NOT IN 066a: CLAUDE.md says a script that deposits
-- Arabic reads it back in the same file. lib/sqlVerificationShape.test.js
-- forbids any SELECT beside DDL and has no carve-out for that exception. The
-- guard is enforced and the prose is not, so the split wins — the same one
-- 056c/056d already made. The divergence is worth reconciling in the docs.
--
-- EXPECTED: three rows, present_expect_true = true on all three.
-- ==========================================================================

with expected (object_name, sentence) as (values
  ('storage_categories',
   'أي مجلّدات المنتجات موجودة بأي مستودع. العلاقة متعدّد-لمتعدّد: المجلّد الواحد ممكن يكون بأكتر من مستودع، والمستودع فيه أكتر من مجلّد. المنتج بيرث مستودعاته من مجلّده، وما فيه عمود مستودع لا على المنتج ولا على المجلّد.'),
  ('storage_id',
   'المستودع. بيتحدّد من نافذة تعديل المستودع، بلوح «المنتجات بالمستودع».'),
  ('category_id',
   'مجلّد المنتجات. حذف السطر معناه إن المجلّد ما عاد بهذا المستودع — ما بينحذف المجلّد نفسه ولا منتجاته.')
),
actual (object_name, stored) as (
  select 'storage_categories',
         obj_description('public.storage_categories'::regclass, 'pg_class')
  union all
  select 'storage_id',
         col_description('public.storage_categories'::regclass,
           (select attnum from pg_attribute
             where attrelid = 'public.storage_categories'::regclass
               and attname = 'storage_id'))
  union all
  select 'category_id',
         col_description('public.storage_categories'::regclass,
           (select attnum from pg_attribute
             where attrelid = 'public.storage_categories'::regclass
               and attname = 'category_id'))
)
select
  e.object_name,
  a.stored,
  (a.stored = e.sentence) as present_expect_true
from expected e
join actual a on a.object_name = e.object_name
order by e.object_name;
