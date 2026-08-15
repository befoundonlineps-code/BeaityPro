-- ==========================================================================
-- ٠٩٤ — تغييرٌ فقط. لا `select` في هذا الملفّ. والتحقّقُ هو ٠٩٤ب.
--
-- 🔴 مُجهَّزٌ ولم أشغّله. المالكُ ينفّذه بيده بعد مراجعته.
-- ترتيبُ التشغيل: ٠٩٤ (هذا) ⟵ ٠٩٥ (الدوالُّ الأربع) ⟵ ٠٩٥ب (التحقّق).
--
-- ⚠️ **و`auth.uid()` فارغةٌ في المحرّر، وRLS متجاوَزةٌ هناك بالكامل.** فنجاحُ
-- هذا السكربت يثبت أن الجدولَ والأعمدةَ والقيودَ وُجدت — **ولا يثبت شيئًا عن
-- العزل بين الصالونات.** السياساتُ أدناه تُقاس بـ٠٩٤ب من `pg_policies`، وسلوكُها
-- الحقيقيُّ لا يظهر إلّا من التطبيق بجلسةٍ حقيقيّة.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- لماذا: تكلفةٌ لكلّ دفعةِ توريدٍ على حدة، بدل المتوسّط المرجّح
--
-- قرارُ المالك: عند إخراج بضاعةٍ يجب أن يُختم **ثمنُها هي** لا متوسّطًا ممزوجًا.
--
-- ✅ **ولا ترحيلَ بيانات.** ٠٩٣ قِيس وأكّد أن `stock_movements` و
-- `stock_documents` **فارغتان تمامًا بكلّ النظام** — فكلُّ حركةٍ من اليوم تصير
-- أوّلَ دفعةٍ لها مباشرةً، **ولا صفَّ قائمٌ يُعاد تفسيرُه.**
--
-- ---------------------------------------------------------------------------
-- 🔴 لماذا لا يوجد جدولُ وصلٍ بين الحركة والدفعة
--
-- كان التصميمُ الأوّل يقترح `stock_movement_lots`، لأن العكسَ لا يستطيع إرجاعَ
-- البضاعة إلى دفعاتها ما لم يُسجَّل ما استهلكه كلُّ سطر.
--
-- **وقرارُ المالك «سطرٌ يستهلك دفعتين ⟵ حركتان منفصلتان» ألغى الحاجة:** حركةٌ
-- واحدةٌ ⟵ دفعةٌ واحدة، فالعلاقةُ N:1 **وجدولُ الوصل ينهار إلى عمود**.
--
-- ⚠️ **والفائدةُ الأكبرُ في العكس:** `reverse_stock_document` تنسخ اليوم
-- `m.unit_cost` من الحركة الأصليّة — فتصير تنسخ `m.lot_id` معها، **وينتهي
-- الأمر**. لا بحثَ عن دفعاتٍ ولا توزيعَ عكسيّ.
--
-- ---------------------------------------------------------------------------
-- 🔴 ولماذا لا يوجد عمود `quantity_remaining`
--
-- **المبدأُ الحاكمُ للموديول: «الرصيدُ مجموعُ حركات، لا عمودًا يُصحَّح» (ADR-051).**
-- وعمودٌ مخزَّنٌ للمتبقّي يخالفه حرفًا: عكسٌ ينسى أن يزيده **ينحرف عن الحركات
-- ولا شيءَ يلاحظ** — رقمٌ غلطٌ متّسقٌ مع نفسه، وهو أخطرُ ما يلاحقه هذا المشروع.
--
-- ⇒ **المتبقّي يُشتقّ:** `sum(quantity_base) where lot_id = …` — الداخلُ موجبٌ
-- والخارجُ سالب. **والعكسُ يصحّح نفسَه** لأنه يكتب حركةً بنفس `lot_id` بكمّيّةٍ
-- معكوسة.
--
-- ---------------------------------------------------------------------------
-- 🔴 والدفعةُ لا تتغيّر بعد كتابتها — ولهذا لا سياسةَ UPDATE ولا DELETE
--
-- كلُّ ما يمكن أن يتغيّر فيها هو المتبقّي، **وهو مشتقٌّ لا مخزَّن.** فما بقي
-- (المستودع · المنتج · السعر · تاريخ الاستلام · المستند) **حقائقُ عن واقعةٍ
-- وقعت**، وتعديلُها إعادةُ كتابةٍ للتاريخ — نفسُ ما ترفضه ADR-051 على الحركة.
--
-- وهذا يطابق `stock_movements` و`stock_documents`: **لا سياسةَ حذفٍ على أيٍّ
-- منهما، والرفضُ بنيويٌّ لا إغفال.**
--
-- ---------------------------------------------------------------------------
-- ⚠️ ولماذا تُضاف قيودُ التفرّد على ثلاثة جداولَ قائمة
--
-- **المفتاحُ الأجنبيُّ المركَّب يحتاج قيدَ تفرّدٍ على نفس الأعمدة التي يشير
-- إليها بالضبط** — وبدونه لا يمكن إنشاؤه أصلًا (نفسُ ما واجهه ٠٥٣أ مع
-- `product_orders_id_salon_key`).
--
-- ⚠️ **وهل تملكها `storages` و`products` و`stock_documents` اليوم؟ غيرُ مسجَّلٍ
-- في أيّ وثيقةٍ عندنا** — والمخطّطُ يسرد الأعمدة ولا يقول شيئًا عن قيودها.
-- **فبدل أن يُفترَض أو تُستهلَك جولةٌ بمسح، يضمنها هذا الملفُّ بنفسه:** حذفٌ
-- بالاسم إن وُجد ثمّ إضافة — فيصحّ سواءٌ كانت موجودةً أم لا.
--
-- ⚠️ **وليست تكرارًا للمفتاح الأساسيّ** رغم أن `id` وحدَه فريد: المفتاحُ الأجنبيُّ
-- يطلب قيدًا على **الزوج**، ولا يقبل بديلًا عنه.
--
-- 🔴 **والسببُ الذي يجعل الزوجَ ضروريًّا أصلًا:** فحصُ التكامل المرجعيِّ **يتجاوز
-- RLS دائمًا**. فبمفتاحٍ على `id` وحدَه يستطيع عميلٌ أن يعلّق دفعةً بمستودعِ
-- صالونٍ آخرَ لا يراه — والصفّان يتناقضان بصمت. والزوجُ يجعل ذلك **غيرَ ممكن**
-- لا **ممنوعًا بسياسة**.
-- ==========================================================================

-- ① أهدافُ المفاتيح المركّبة على الجداول القائمة.
alter table public.storages
  drop constraint if exists storages_id_salon_key;
alter table public.storages
  add constraint storages_id_salon_key unique (id, salon_id);

alter table public.products
  drop constraint if exists products_id_salon_key;
alter table public.products
  add constraint products_id_salon_key unique (id, salon_id);

alter table public.stock_documents
  drop constraint if exists stock_documents_id_salon_key;
alter table public.stock_documents
  add constraint stock_documents_id_salon_key unique (id, salon_id);

-- ② الدفعة.
create table if not exists public.stock_lots (
  id                  uuid          primary key default gen_random_uuid(),
  salon_id            uuid          not null references public.salons (id) on delete restrict,
  storage_id          uuid          not null,
  product_id          uuid          not null,

  -- المستندُ الذي أنشأ هذه الدفعة: توريدٌ أو افتتاحٌ أو نقلٌ داخلٌ أو فائضُ جرد.
  --
  -- ⚠️ `NOT NULL` بلا استثناء: **لا دفعةَ بلا واقعةٍ أنشأتها.** ودفعةٌ بلا مستند
  -- تعني رقمًا لا مصدرَ له، وهو بالضبط ما يوجد هذا المشروعُ كلُّه لمنعه.
  source_document_id  uuid          not null,

  -- 🔴 ثمنُ هذه الدفعة هي — الرقمُ الذي يُختم على كلّ خروجٍ منها.
  --
  -- `numeric(14,4)` منسوخةٌ حرفًا من `stock_movements.unit_cost` (٠٥٠ب): نوعان
  -- مختلفان لرقمٍ واحدٍ ينتقل بينهما **يقرّبان عند النسخ**، وفرقُ قرشٍ لا مصدرَ
  -- له هو ما يقضي فيه المرءُ ساعةً بعد شهر.
  unit_cost           numeric(14,4) not null check (unit_cost >= 0),

  -- ⚠️ هل جاء السعرُ من ثمنٍ دُفع فعلًا؟ **نفسُ معنى العمود على الحركة تمامًا:**
  -- `false` = ثمنٌ أملاه إنسانٌ على مستند. `true` = بديلٌ اشتُقّ لأن لا ثمنَ كان
  -- متاحًا — وهذا يقع في فائض الجرد وحدَه، إذ لا مورّدَ له ولا فاتورة.
  cost_is_estimated   boolean       not null default false,

  -- تاريخُ الاستلام — أساسُ ترتيب FIFO.
  --
  -- ⚠️ **يُملأ من `doc_date` لا من `now()`**: بضاعةٌ وصلت الأسبوع الماضي وسُجّلت
  -- اليوم دفعتُها أقدمُ من دفعةِ اليوم، **وتاريخُ الكتابة يقلب الترتيب.**
  received_at         timestamptz   not null,

  -- ⚠️ ولا يكفي `received_at` وحدَه لترتيبٍ تامّ: دفعتان بنفس اليوم تتساويان،
  -- **وترتيبٌ غيرُ تامّ يعطي قراءتين مختلفتين لنفس السؤال.** فالترتيبُ المعتمَد
  -- `(received_at, created_at, id)` — وهي نفسُ العلّة التي عُولجت في ترتيب
  -- الطلبيّات بـ`sort_order` ثمّ `id`.
  created_at          timestamptz   not null default now(),

  -- ⚠️ هدفُ المفتاح المركَّب من `stock_movements.lot_id`. بدونه لا يمكن إنشاؤه.
  constraint stock_lots_id_salon_key unique (id, salon_id),

  constraint stock_lots_storage_fkey
    foreign key (storage_id, salon_id)
    references public.storages (id, salon_id) on delete restrict,

  constraint stock_lots_product_fkey
    foreign key (product_id, salon_id)
    references public.products (id, salon_id) on delete restrict,

  constraint stock_lots_document_fkey
    foreign key (source_document_id, salon_id)
    references public.stock_documents (id, salon_id) on delete restrict
);

-- ③ ربطُ الحركة بدفعتها.
--
-- ⚠️ `NOT NULL` **وبلا افتراضيّ**، وكلاهما مقصود:
--
--   • **بلا افتراضيّ** — عمودٌ جديدٌ بافتراضيٍّ يكتب ادّعاءً عن كلّ صفٍّ قائم
--     (البند ٨)، وهنا لا صفَّ قائمًا أصلًا فالافتراضيُّ يكذب على العدم.
--   • **`NOT NULL`** — لأن الجدولَ فارغ، فالقيدُ يمرّ اليوم ولا يمرّ غدًا.
--     **وعمودٌ يقبل العدم هنا معناه «حركةٌ لا تعرف دفعتَها»، وهي الحالةُ التي
--     يُبنى هذا كلُّه لإلغائها** — ولو قُبلت مرّةً لصارت مقبولةً كلَّما صعب
--     الجواب.
alter table public.stock_movements
  add column if not exists lot_id uuid not null;

alter table public.stock_movements
  drop constraint if exists stock_movements_lot_fkey;
alter table public.stock_movements
  add constraint stock_movements_lot_fkey
  foreign key (lot_id, salon_id)
  references public.stock_lots (id, salon_id) on delete restrict;

-- ④ الفهارس — واحدٌ لكلّ سؤالٍ تسأله الدوالُّ الأربع.
--
-- ⚠️ ترتيبُ الأعمدة هو ترتيبُ السؤال: «دفعاتُ هذا المنتج في هذا المستودع،
-- الأقدمُ أوّلًا» — فالمرشِّحُ أوّلًا والترتيبُ بعده، وإلّا رتّب المخطِّطُ بيده.
create index if not exists stock_lots_fifo_idx
  on public.stock_lots (salon_id, storage_id, product_id, received_at, created_at, id);

-- ⚠️ وهذا هو فهرسُ **المتبقّي**: `sum(quantity_base) group by lot_id` يُنفَّذ عند
-- كلّ اختيارِ دفعة، فهو أكثرُ استعلامٍ سيُقرأ في هذا الموديول.
create index if not exists stock_movements_lot_idx
  on public.stock_movements (lot_id);

create index if not exists stock_lots_document_idx
  on public.stock_lots (source_document_id);

-- ⑤ العزل.
alter table public.stock_lots enable row level security;

grant select, insert on public.stock_lots to authenticated;

-- ⚠️ **ولا `update` ولا `delete` في المنحة أصلًا** — لا بالسياسات وحدها.
-- السياسةُ تُصفّي الصفوف، والمنحةُ تقرّر إن كان الدورُ يلمس الجدولَ من الأساس.
-- وغيابُ الاثنين معًا يجعل تعديلَ دفعةٍ **غيرَ ممكنٍ من طريقين لا واحد**.

drop policy if exists stock_lots_select on public.stock_lots;
create policy stock_lots_select on public.stock_lots
  for select
  using (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- ⚠️ الدوالُّ الأربعُ ليست `SECURITY DEFINER` (مقيسٌ: ٠٥٠ج قاست `prosecdef = false`)،
-- فهي تعمل بصلاحيّة المنادي **وتمرّ من هذه السياسة**. فبدونها لا تكتب الدوالُّ
-- شيئًا — وليست هذه طبقةً ثانيةً بل الطبقةَ الوحيدة.
drop policy if exists stock_lots_insert on public.stock_lots;
create policy stock_lots_insert on public.stock_lots
  for insert
  with check (salon_id = (select profiles.salon_id from public.profiles where profiles.id = auth.uid()));

-- ⑥ الأوصافُ التي تُقرأ من القاعدة نفسها — تُقرأ راجعةً بـ٠٩٤ب.

comment on table public.stock_lots is
  'دفعةُ توريدٍ واحدة: كمّيّةٌ دخلت مستودعًا بثمنٍ معروفٍ في لحظةٍ معروفة. وكلُّ إخراجٍ من المخزون يُختم بثمن دفعته هو لا بمتوسّطٍ ممزوج، وهذا هو الغرض. ⚠️ والصفُّ لا يتغيّر بعد كتابته: المتبقّي منه ليس عمودًا هنا بل مجموعُ حركاته (sum(quantity_base) على lot_id)، لأن الرصيد عند هذا الموديول مجموعُ حركاتٍ لا عمودٌ يُصحَّح — ولذلك لا سياسةَ تعديلٍ ولا حذفٍ عليه.';

comment on column public.stock_lots.unit_cost is
  'ثمنُ الوحدة الأساسية لهذه الدفعة، منسوخُ النوع حرفًا من stock_movements.unit_cost كي لا يُقرَّب رقمٌ وهو ينتقل بينهما. وهو الرقمُ الذي يُختم على كلّ حركة خروجٍ من هذه الدفعة.';

comment on column public.stock_lots.cost_is_estimated is
  'هل جاء السعرُ من ثمنٍ دُفع فعلًا. false = ثمنٌ أملاه إنسانٌ على مستند توريدٍ أو افتتاح. true = بديلٌ اشتُقّ لأن لا ثمنَ كان متاحًا، ويقع في فائض الجرد وحدَه إذ لا مورّدَ له ولا فاتورة. ⚠️ ونفسُ معنى العمود على stock_movements بالضبط، لا معنًى ثانٍ.';

comment on column public.stock_lots.received_at is
  'تاريخُ استلام البضاعة كما كتبه إنسانٌ على المستند (doc_date)، لا لحظةَ كتابة الصفّ. وعليه يقوم ترتيبُ الأقدم أوّلًا. ⚠️ وهو وحدَه لا يكفي لترتيبٍ تامّ — دفعتان بنفس اليوم تتساويان — فالترتيبُ المعتمَد (received_at, created_at, id)، وترتيبٌ غيرُ تامٍّ يعطي قراءتين مختلفتين لنفس السؤال.';

comment on column public.stock_movements.lot_id is
  'الدفعةُ التي أتت منها هذه الحركة أو التي أنشأتها. ⚠️ وحركةٌ واحدةٌ لدفعةٍ واحدةٍ دائمًا: سطرٌ يستهلك دفعتين يصير حركتين، كلٌّ بثمن دفعتها — لأن حركةً واحدةً بثمنٍ ممزوجٍ تعيد المتوسّطَ من الباب الخلفيّ وتُلغي الغرض. ولهذا لا يوجد جدولُ وصلٍ بين الحركة والدفعة، والعكسُ ينسخ هذا العمود كما ينسخ unit_cost فيرجّع البضاعةَ إلى دفعتها بلا حساب.';
