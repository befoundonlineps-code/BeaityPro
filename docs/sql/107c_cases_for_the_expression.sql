-- ==========================================================================
-- 107c -- CASES. Builds rows, measures them, and rolls every one of them back.
--
-- 🔴 **ليس في ترتيب تشغيل المالك. ترتيبُه `107` ثمّ `107b`، ولا ثالث.**
-- **هذا الملفُّ لقاعدةِ مراجعةٍ يبنيها المراجع** — يُرسَل معه ليُنفَّذ **قبل
-- الدفع**، بالبروتوكول المتّفق عليه: أيُّ ملفّ SQL جديدٍ يُعرض ومعه الحالاتُ
-- التي يُراد قياسُه عليها.
--
-- ✅ **ولا يترك أثرًا حتى لو شُغّل على قاعدةٍ حقيقيّةٍ بالخطأ**، وذلك بنيويٌّ لا
-- تحذير: كلُّ الإدراجات داخل كتلةٍ فرعيّةٍ تنتهي بـ`raise exception`، **فتُلغى
-- كلُّها عند التقاط الاستثناء.** والناجي متغيّرُ PL/pgSQL وحدَه، و`set_config`
-- **بعد** الكتلة لا داخلها — وهي قاعدةُ `CLAUDE.md` البند ١ب بحرفها.
--
-- ⚠️ **ولا `create temp table`** — تُصنَّف `ddl` فتقع تحت البند ١، و`do $$…$$`
-- تُصنَّف `other` فتمرّ مع `select`. **والحارسُ `sqlVerificationShape` يقيسها.**
--
-- ---------------------------------------------------------------------------
-- الحالاتُ الستّ، وما يُتوقَّع من كلٍّ منها
--
--   A  مستندٌ عاديٌّ لم يُعكس، وعليه غرامة       ⟶ new=f · old=f · voided=—
--   B  مستندٌ عاديٌّ عُكس، وعليه غرامة           ⟶ new=t · old=t · voided=R1
--   C  مستندُ العكس R1 نفسُه، وعليه غرامة        ⟶ **new=f · old=t** · voided=—
--      🔴 **الحالةُ التي يصلحها ١٠٧، والوحيدةُ التي يختلف فيها العمودان.**
--   D  مستندُ عكسٍ عُكس بدوره، وعليه غرامة        ⟶ new=t · old=t · voided=R4
--      ⚠️ **ممنوعةٌ في المنبع** — `cannot_reverse_a_reversal` (٠٩٥:٩٠٦)،
--      **فتُبنى بإدراجٍ مباشرٍ وحدَه.** ولا تُعدّ حالةً يعالجها ١٠٧: التعبيرُ
--      يصيبها لو بُلغت، **وذلك صحّةٌ على مجموعةٍ أوسعَ من المبلوغ.**
--   F  مستندُ عكسٍ **بلا غرامة**                 ⟶ **صفرُ صفوفٍ في الـview**
--      ⚠️ يقيس أن التعبيرَ لا يُنشئ صفًّا حيث لا غرامة — طلبُ المراجع.
--
--   E  غرامةٌ يتيمةٌ بلا صفِّ حيويّة              ⟶ new=(عدم) · old=(عدم)
--      🔴 **غيرُ قابلةٍ للبناء هنا، ويُقال بدل أن يُدَّعى:** المفتاحُ المركّب
--      `(document_id, salon_id)` و`document_id NOT NULL` **يمنعان وجودَها على
--      مخطّطٍ سليم.** ⇒ **وصفتُها:** تُسقَط `stock_fines_document_id_fkey`
--      ويُجعل العمودُ nullable، ثمّ تُدرَج غرامةٌ بعدمٍ في `document_id`.
--      **وهي القاعدةُ المهيّأةُ التي قاس عليها المراجعُ الصورتين من قبل**،
--      والصفُّ الذي أسقط `null_is_void` وأسقط الصورةَ الأولى معه.
--
-- ⚠️ **و«الحالي» (old) يُطبع بجانب «الجديد» (new) عمدًا** — قاعدةُ «الحارسُ
-- يطبع ما قاسه بجانب ما حكم به»: **مخرَجٌ يحمل بيّنةَ تكذيبِ حكمه معه.**
--
-- ---------------------------------------------------------------------------
-- 🔴 والمسوّدةُ الأولى سقطت بـ`23502`، ومصدرُ الأعمدة هو ما سقط
--
-- **بُنيت قائمةُ إدراج `stock_fines` من تعريف الجدول في ٠٥٦أ، فأسقطت
-- `attribution`** — **وهو `NOT NULL`، مقيسًا في مخرَج ١٠٦ب الذي كان بين
-- أيدينا في نفس المحادثة.** نفّذه المراجعُ على جدولٍ بناه من ذلك المخرَج:
--
--     ERROR:  null value in column "attribution" of relation "stock_fines"
--             violates not-null constraint
--
-- ⇒ **والقائمةُ الآن منسوخةٌ من ٠٩٥:٧٧٩** — الإدراجِ الذي يعمل في الإنتاج.
-- **والقاعدةُ: تُؤخذ أعمدةُ الإدراج من إدراجٍ يعمل، لا من تعريف الجدول** —
-- فتعريفُ الجدول يقول ما هو مسموح، والإدراجُ العامل يقول ما هو كافٍ.
--
-- ---------------------------------------------------------------------------
-- ⚠️ ومصدرُ كلّ قيمةٍ تعداديّةٍ هنا يُسمّى، لأن واحدةً خاطئةً تُسقط الكتلةَ كلَّها
--
--   `stocktake` · `reversal`   ✅ **من الكتالوج** — ٠٩٦ب قرأ `stock_doc_type`
--                                 تسعَ قيمٍ من `pg_enum`
--   `purchase_price`           ✅ **من الكتالوج** — ٠٥٦أ:٢٢-٢٦ يقول إنها مسحٌ
--                                 لا افتراض: `fine_basis  purchase_price | sales_price`
--   `posting`                  ⚠️ **من ملفّ** — `create type fine_attribution`
--                                 في ٠٥٦أ:٩٤، قيمةً وحيدة
--   `no_responsible`           ⚠️ **من ملفّ** — `create type fine_resolution`
--                                 في ٠٥٦أ:١٠٤-١١٠، خمسُ قيم
--
-- ⇒ **فاثنتان مقيستان واثنتان مقروءتان، والفرقُ يُقال بدل أن يُطمس.**
-- ==========================================================================

do $$
declare
  v_log     text := '';
  v_salon   uuid;
  v_storage uuid;
  v_a  uuid; v_b uuid; v_r1 uuid;
  v_c  uuid; v_r3 uuid; v_r4 uuid;
  v_d  uuid; v_r5 uuid;

  -- ⚠️ **متغيّرٌ لكلّ دور، ولا إعادةَ استعمال.** المسوّدةُ الأولى جعلت `v_c`
  -- مستندًا في الأعلى ومخرَجَ `voided_by` في الحلقة، **فكانت الحلقةُ تدهس
  -- مستندًا لا يزال مقروءًا** — بلا خطأٍ في أيّ مكان.
  v_doc    uuid;      -- المستندُ المفحوصُ في هذه الدورة
  v_voided uuid;      -- ومَن ألغاه، كما أعاده الـview
  v_new    boolean;   -- is_void بعد ١٠٧
  v_old    boolean;   -- not is_live — أي ما كان يعطيه ١٠٦
  v_rows   int;

  -- 🔴 **الطورُ يُسمّى، لأن «لم تُبنَ الحالات» و«بُنيت فلم تقل ما توقّعنا»
  -- كانا يخرجان بنفس الشكل.** `exception when others` يبتلع الاثنين، والقارئُ
  -- يقرأ سطرًا واحدًا فيظنّ القياسَ وقع. **وهو عينُ «فحصٌ يعطي نفسَ الجواب
  -- بالحالتين ليس فحصًا».**
  v_phase  text := 'بدء';
begin
  begin
    -- ⚠️ صفٌّ حقيقيٌّ يُؤخذ كما هو، ولا مطابقةَ بالاسم (البند ٤). والمستودعُ
    -- وصالونُه من نفس الصفّ، لأن مفاتيح الغرامة مركّبةٌ على (…, salon_id).
    v_phase := 'اختيارُ مستودعٍ وصالون';
    select st.salon_id, st.id into v_salon, v_storage
      from public.storages st
     order by st.id
     limit 1;

    if v_salon is null then
      v_log := '💥 لا مستودعَ في القاعدة — لا يمكن بناءُ الحالات';
      raise exception 'ROLLBACK_MARKER';
    end if;

    -- ── المستندات ───────────────────────────────────────────────────────────
    -- ✅ قائمةُ الأعمدة **من إدراجٍ يعمل في الإنتاج** (٠٩٥:٩١٦ داخل
    -- `reverse_stock_document`)، لا من تعريف الجدول. **وذلك ما يضمن أن كلَّ
    -- عمودٍ إجباريٍّ بلا افتراضيٍّ حاضر:** الدالّةُ تُدرج بهذه القائمة كلَّ يوم.
    v_phase := 'إدراجُ المستندات الثمانية';
    insert into public.stock_documents (salon_id, doc_type, storage_id, doc_date, note)
    values (v_salon, 'stocktake', v_storage, now(), 'case-A') returning id into v_a;

    insert into public.stock_documents (salon_id, doc_type, storage_id, doc_date, note)
    values (v_salon, 'stocktake', v_storage, now(), 'case-B') returning id into v_b;

    insert into public.stock_documents (salon_id, doc_type, storage_id,
                                        reverses_document_id, doc_date, note)
    values (v_salon, 'reversal', v_storage, v_b, now(), 'case-C (reverses B)')
    returning id into v_r1;

    insert into public.stock_documents (salon_id, doc_type, storage_id, doc_date, note)
    values (v_salon, 'stocktake', v_storage, now(), 'case-D base') returning id into v_c;

    insert into public.stock_documents (salon_id, doc_type, storage_id,
                                        reverses_document_id, doc_date, note)
    values (v_salon, 'reversal', v_storage, v_c, now(), 'case-D (reverses base)')
    returning id into v_r3;

    -- ⚠️ عكسُ عكسٍ — **الدالّةُ ترفضه، وهذا إدراجٌ مباشرٌ يتخطّاها عمدًا.**
    insert into public.stock_documents (salon_id, doc_type, storage_id,
                                        reverses_document_id, doc_date, note)
    values (v_salon, 'reversal', v_storage, v_r3, now(), 'case-D reverser')
    returning id into v_r4;

    insert into public.stock_documents (salon_id, doc_type, storage_id, doc_date, note)
    values (v_salon, 'stocktake', v_storage, now(), 'case-F base') returning id into v_d;

    insert into public.stock_documents (salon_id, doc_type, storage_id,
                                        reverses_document_id, doc_date, note)
    values (v_salon, 'reversal', v_storage, v_d, now(), 'case-F (no fine on it)')
    returning id into v_r5;

    -- ── الغرامات ────────────────────────────────────────────────────────────
    -- 🔴 **القائمةُ منسوخةٌ من ٠٩٥:٧٧٩ حرفًا — الكاتبُ الوحيدُ للغرامات في
    -- الإنتاج.** والمسوّدةُ الأولى بنتها من تعريف الجدول في ٠٥٦أ فأسقطت
    -- `attribution`، **وهو `NOT NULL`** — فسقط الإدراجُ بـ`23502` على قاعدةِ
    -- مراجعةٍ بُنيت من مخرَج ١٠٦ب.
    --
    -- ⚠️ **و`attribution` تُكتب صراحةً وإن كان للعمود افتراضيّ**، وذلك نصُّ
    -- التعليق فوق الإدراج في ٠٩٥ بلفظه: *"attribution is written out although
    -- the column defaults to it: what is being claimed is the point of the row,
    -- and a default states it in a place nobody reading this function would
    -- look."* ⇒ **فالسببُ كان مكتوبًا ثلاثةَ أسطرٍ فوق القائمة التي نسختُ
    -- منها نصفَها.**
    --
    -- `no_responsible` تجعل `employee_id` و`role_at_resolution` عدمًا، وهو ما
    -- يوجبه القيدان `employee_matches_resolution` و`role_text_matches_resolution`.
    v_phase := 'إدراجُ الغرامات الأربع';
    insert into public.stock_fines (id, salon_id, document_id, storage_id, employee_id,
                                    attribution, resolution, role_at_resolution,
                                    fine_percent, fine_basis)
    values (gen_random_uuid(), v_salon, v_a,  v_storage, null,
            'posting', 'no_responsible', null, 10, 'purchase_price'),
           (gen_random_uuid(), v_salon, v_b,  v_storage, null,
            'posting', 'no_responsible', null, 10, 'purchase_price'),
           (gen_random_uuid(), v_salon, v_r1, v_storage, null,
            'posting', 'no_responsible', null, 10, 'purchase_price'),
           (gen_random_uuid(), v_salon, v_r3, v_storage, null,
            'posting', 'no_responsible', null, 10, 'purchase_price');
    -- ولا غرامةَ على v_r5 — وهي الحالة F.

    -- ✅ **شاهدُ أن البناءَ تمّ** — فلا يُقرأ الفشلُ في القياس بناءً ناقصًا.
    v_log := v_log || 'BUILD: 8 documents + 4 fines ✅' || E'\n';

    -- ── القياس ──────────────────────────────────────────────────────────────
    v_phase := 'قراءةُ الحالات A · B · C · D';
    foreach v_doc in array array[v_a, v_b, v_r1, v_r3] loop
      select v.is_void, v.voided_by_document_id
        into v_new, v_voided
        from public.stock_fine_voidness v
       where v.document_id = v_doc;
      select not l.is_live into v_old
        from public.stock_document_liveness l
       where l.document_id = v_doc and l.salon_id = v_salon;
      v_log := v_log
        || (select d.note from public.stock_documents d where d.id = v_doc)
        || ': new=' || coalesce(v_new::text, '(عدم)')
        || ' old=' || coalesce(v_old::text, '(عدم)')
        || ' voided_by=' || coalesce(
             (select d.note from public.stock_documents d where d.id = v_voided), '—')
        || E'\n';
    end loop;

    -- الحالة F — صفرُ صفوفٍ هو المتوقَّع، ورقمٌ يُطبع لا حكمٌ يُقال.
    v_phase := 'قراءةُ الحالة F';
    select count(*) into v_rows
      from public.stock_fine_voidness v where v.document_id = v_r5;
    v_log := v_log || 'case-F (reversal with no fine): rows_in_view=' || v_rows
                   || ' (expect 0)' || E'\n';

    raise exception 'ROLLBACK_MARKER';
  exception when others then
    if sqlerrm <> 'ROLLBACK_MARKER' then
      -- 🔴 **الطورُ يسبق الرمز** — فيُقرأ «أين سقط» قبل «بماذا سقط».
      v_log := v_log || '💥 سقط في الطور [' || v_phase || '] — '
                     || sqlstate || ' — ' || sqlerrm;
    end if;
  end;

  -- ⚠️ **بعد الكتلة لا داخلها:** تراجعُ المعاملة الفرعيّة يمحو `set_config`
  -- كما يمحو الإدراج.
  perform set_config('probe.result', v_log, false);
end $$;

-- 🔴 **`, true` وليس بلا معامل — وهي حرفان يقرّران أيَّ خطأٍ يراه القارئ.**
-- **خطأُ الكتلة يجب أن يُقرأ، لا أن يُغطَّى بخطأِ قراءةِ نتيجتها.** لو سقطت
-- الكتلةُ **الخارجيّة** — خطأُ ترجمةٍ في الإعلانات، أيُّ شيءٍ خارج
-- `begin … exception` الداخليّة — **فـ`probe.result` لا يُضبط أصلًا**، وترفع
-- الصيغةُ المفردة `unrecognized configuration parameter` **فوق** الخطأ
-- الحقيقيّ، فيقرأ القارئُ رسالةً عن معاملٍ مجهولٍ لا عن سبب السقوط.
--
-- ✅ **مقيسٌ عند المراجع على معاملٍ غيرِ موجود:** ذاتُ المعاملين أعادت صفًّا
-- فارغًا، والمفردةُ رفعت الخطأ. ⇒ **والقاعدةُ هي نفسُها التي أضافت `v_phase`:
-- الحارسُ لا يحجب ما قاسه.**
select current_setting('probe.result', true) as cases_107c;
