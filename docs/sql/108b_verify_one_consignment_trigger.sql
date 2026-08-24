-- ==========================================================================
-- 108b -- VERIFICATION ONLY. One SELECT, and it changes nothing.
--
-- ⚠️ **جملةٌ واحدة، لأن محرّرَ Supabase يعرض مجموعةَ النتائج الأخيرة وحدَها.**
--
-- ⚠️ **ولا `::regclass`** — التحويلُ يرفع `42P01` لو غاب الجدول، فيسقط التحقّقُ
-- كلُّه بخطأِ تحويلٍ بدل أن يقول `0`. **والوصلُ على الكتالوج يجيب في الحالتين.**
--
-- ---------------------------------------------------------------------------
-- ما يُقرأ، ولماذا كلٌّ منه
--
--   user_triggers_on_products   🔴 **الحكم: واحدٌ لا اثنان.** ورقمٌ يُطبع لا
--                               حكمٌ يُقال — فالقارئُ يخالفه إن شاء.
--   user_trigger_names          **وأسماؤها معه**، لأن «واحد» لا تقول أيُّهما
--                               بقي. ⚠️ **والعددُ وحدَه كان سيمرّ لو حُذف
--                               الخطأُ منهما** — وهو الاحتمالُ الذي حذّر منه ١٠٨.
--   trg_prefixed_remaining      **وسؤالٌ صريحٌ عن المحذوف بعينه**، فلا يُستدلّ
--                               على غيابه من عددٍ مجمَل. **المتوقَّع: 0**.
--   unprefixed_remaining        **وعن الباقي بعينه كذلك. المتوقَّع: 1** —
--                               🔴 **وهذا شاهدُ الصدق:** لو عاد الاثنان `0`
--                               لكان الاستعلامُ لا يرى المشغّلاتِ أصلًا،
--                               **و«حُذف» و«لم أسأل» يتطابقان بلا هذا العمود.**
--   surviving_definition        **تعريفُ الباقي كاملًا، يُقرأ بالعين.** وهو
--                               ✅ **قالبُ الاسترجاع:** الاثنان مقيسان
--                               متطابقين عدا الاسم، **فتبديلُ الاسم فيه يعيد
--                               المحذوفَ حرفًا** لو ظهر له سببٌ لم نره.
--   internal_triggers           **وعددُ المشغّلات الداخليّة معه** — تلك التي
--                               يفرضها المفتاحُ الأجنبيّ. ⚠️ **تُذكر لأنها
--                               مستثناةٌ بـ`not tgisinternal`**، و«ما استُثني
--                               يُقال» أرخصُ من قارئٍ يتساءل أين ذهبت.
--                               🔴 **والمتوقَّعُ منها ليس رقمًا: «أكبرُ من صفر،
--                               واثنان لكلّ مفتاحٍ أجنبيٍّ يمسّ الجدول».**
--                               ⚠️ **قيل «المتوقَّع ٢» فجاءت ٢٤، والاثنتان
--                               صحيحتان:** الـ٢ من قاعدة مراجعةٍ فيها مفتاحٌ
--                               واحدٌ يمسّ `products`، والـ٢٤ من قاعدة المالك
--                               وفيها اثنا عشر. **ورقمُ نسخةٍ نُقل توقُّعًا عن
--                               قاعدةٍ أخرى** — والحدُّ المُعلَن عن تلك النسخة
--                               («تُترجَم وتعمل، لا أنها Supabase») **أُعلن عن
--                               السلوك ونُسي عن الأرقام.**
--                               ✅ **والعمودُ أدّى وظيفتَه:** غرضُه أن يشهد أنّ
--                               الاستعلامَ **يرى** المشغّلات، **و٢٤ تشهد بذلك
--                               أبلغَ من ٢.**
--
-- ---------------------------------------------------------------------------
-- ✅ وأنّ السلوكَ لم يتغيّر — مقيسٌ بالتجربة، لا مقروءٌ من نصّ الدالّة
--
-- **كُتب هنا أوّلًا أنّ هذا لا يُقاس:** «الدالّةُ لا تكتب شيئًا» قياسٌ على نصّها
-- **لا تجربةٌ على تعديل صفٍّ قبل الحذف وبعده.** ⇒ **وأُغلقت الفجوةُ عند المراجع
-- على نسخةٍ بالمشغّلَين معًا، ثمّ بواحد:**
--
--   P1  أمانةٌ لها حركةٌ حيّة، ويُقلب حقلُ الأمانة
--       قبل (٢ مشغّل) ⟶ رُفض `P0001` · `consignment_flag_locked`
--       بعد  (١ مشغّل) ⟶ رُفض `P0001` · **نفسُ الرسالة حرفًا**
--
--   P2  أمانةٌ بلا حركة، ويُقلب حقلُ الأمانة
--       قبل ⟶ مرّ        ·      بعد ⟶ مرّ
--
-- ⇒ **ما يُرفض يُرفض بنفس الرمز والنصّ، وما يُقبل يُقبل** — **فالتكافؤُ تجربةٌ
-- على صفٍّ الآن، لا استدلالٌ من فرعين.** ⚠️ **والنسخةُ بُنيت بنصّ الدالّة الخامّ
-- من `pg_get_functiondef`** لا بإعادة صياغة، **و`product_balances` بلا مرشّح
-- حيويّةٍ كما يصفه ٠٨١_١** — فالمقيسُ سلوكُ الدالّة لا سلوكَ نسخةٍ تشبهها.
-- ==========================================================================

select
  -- 🔴 الحكم. `not tgisinternal` يستثني ما يفرضه المفتاحُ الأجنبيّ وحدَه.
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and not t.tgisinternal)                              as user_triggers_on_products,

  (select string_agg(t.tgname, ' · ' order by t.tgname)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and not t.tgisinternal)                              as user_trigger_names,

  -- المحذوفُ بعينه — **المتوقَّع 0**.
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and t.tgname = 'trg_freeze_consignment_after_use')   as trg_prefixed_remaining,

  -- والباقي بعينه — **المتوقَّع 1، وهو شاهدُ الصدق.** انظر الترويسة.
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and t.tgname = 'freeze_consignment_after_use')       as unprefixed_remaining,

  -- ✅ وقالبُ الاسترجاع — يُقرأ بالعين، ولا يُطابَق بنصٍّ متوقَّع.
  (select pg_get_triggerdef(t.oid)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and t.tgname = 'freeze_consignment_after_use')       as surviving_definition,

  -- وما استُثني، يُقال.
  (select count(*)
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'products'
      and t.tgisinternal)                                  as internal_triggers;
