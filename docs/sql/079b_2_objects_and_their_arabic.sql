-- ==========================================================================
-- 079b_2 -- SURVEY ONLY. Read-only: nothing is written. RUN AFTER 079a.
--
-- ⚠️ THE FOUR ARABIC STRINGS BELOW WERE COPIED OUT OF 079a MECHANICALLY, NOT
-- RETYPED — a comparison whose expected value carries a typo reports a fault
-- that does not exist, and the next person "fixes" the database to match it.
--
-- ⚠️ AND THE MIRROR IS GUARDED, BECAUSE THIS PROJECT HAS PAID FOR EXACTLY THIS
-- TWICE: the descendant walk drifted between 068a and 068b_3 inside one round,
-- and it is why 069a exists. Two files holding one sentence is the same shape.
-- lib/sqlArabicMirror.test.js reads BOTH files and fails the suite the moment
-- they differ — so an edit to 079a's Arabic that forgets this file is caught
-- at `npx jest`, not by the owner running SQL and reading 🔴 four times.
--
-- ---------------------------------------------------------------------------
-- 🔴 TWO FAULTS FROM THE PREVIOUS DRAFT ARE FIXED HERE, AND THEY SHARE A CURE.
--
-- ⚠️ FAULT 1 — A MISSING OBJECT PRODUCED A MISSING ROW, NOT A WARNING.
--
-- Every branch was `... from pg_class c where c.relname = '…'`. No view, no
-- row: eight rows instead of nine and nothing saying which one left. And
-- coalesce(…, '⚠️') guards an empty VALUE, never an absent ROW — so the guard
-- that looked like it covered this covered something else.
--
-- The index branch was the worst of them: `where … like '%(reverses_document_id)%'`.
-- No index, no row, no warning — in the line written specifically to measure a
-- dependency nobody can see.
--
-- ⚠️ AND THIS IS 068b_2 WORD FOR WORD, FIXED ONE ROUND AGO: a cross join gave
-- zero rows and became `left join fn on true` "so that a missing function is
-- REPORTED rather than merely absent". Same fault, same file series, one round
-- later.
--
-- ✅ Cure: every branch is an AGGREGATE over the catalogue, with no FROM on the
-- outer select. An aggregate with no GROUP BY returns exactly one row even
-- over zero input rows, so a branch structurally cannot vanish — and
-- `count(*) = 0` is what distinguishes "the object is gone" from "the object
-- is there and the property is wrong". Two different failures, two different
-- sentences, neither of them silence.
--
-- ---------------------------------------------------------------------------
-- ⚠️ FAULT 2 — THE ARABIC WAS DISPLAYED, NOT COMPARED.
--
-- The previous draft printed obj_description and the hints for the eye. But
-- 066c_5, 068b_2 and 069b_1 all compare character by character against a
-- written sentence, and the rule says why: "not whether it contains Arabic
-- letters". Nobody proof-reads a four-hundred-character Arabic paragraph.
--
-- ⚠️ And the incident the rule exists for would have walked straight past a
-- display: eighteen sentences were silently TRANSLATED when an encoding fix
-- overreached. Each one still contained Arabic. Each one still read fluently.
-- Only a comparison catches that.
--
-- So the four rows now answer ✅ / 🔴, and a mismatch prints what is actually
-- in the database beside the verdict, because a diff nobody can act on is the
-- same as no diff.
--
-- ---------------------------------------------------------------------------
-- WHY EACH NON-ARABIC ROW IS HERE:
--
-- security_invoker      CLAUDE.md item 6. `create or replace view` without
--                       WITH resets options to defaults, and the failure is
--                       INVISIBLE while one salon exists — which is now. A
--                       view running with its owner's rights shows every
--                       salon's documents to every salon.
--
-- product_balances      Not touched by this round. A free re-measurement of
--                       something three guards read.
--
-- prosecdef = true      ⚠️ INVERTED FROM THE DRAFT. `false` is now the
--                       failure. Written down because the tempting "fix" for
--                       a later reader is reverting to invoker — which fails
--                       toward PERMISSION: the sums come back zero and the
--                       change is allowed, the one case the guard exists for.
--
-- proconfig             A definer function owned by postgres resolves
--                       unqualified names through the CALLER's search_path,
--                       and its owner bypasses RLS (measured in 068b_1).
--
-- raises                The codes read off the STORED body rather than off a
--                       file. lib/raisedCodes.test.js enforces the same thing
--                       against docs/sql — but it reads the file. This row
--                       reads the database, the only place the two can differ.
--
-- tgtype = 19           ROW(1) + BEFORE(2) + UPDATE(16).
--
-- the unique index      ⚠️ The view's left join cannot fan out only because
--                       045 put a single-column UNIQUE index on
--                       reverses_document_id — and until this row runs that is
--                       a script's claim about its own intent, not a fact from
--                       the catalogue. Item 4ب: ask the catalogue, not the
--                       memory.
--
-- ⚠️ AND THE HINTS DO NOT REACH A USER — an earlier draft of this file said
-- they did, and our own measurement says otherwise. dbErrorSentence takes the
-- named key FIRST and throws the hint away (068a), and both new codes have
-- keys. The hints reach whoever opens the logs or reads the function: a real
-- audience, and a different one. It matters because somebody who believes the
-- hint is the user-facing sentence spends on it the care the locale file
-- deserves, and under-writes the sentence that actually shows.
--
-- ⚠️ ONE QUERY, NOT ELEVEN. The Supabase editor returns only the LAST result
-- set of a multi-statement script, so eleven statements would print one answer
-- and hide ten.
-- ==========================================================================

select 'view · stock_document_liveness' as object,
       'reloptions — expect {security_invoker=true}' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للمنظور أصلًا)'
                     else coalesce(string_agg(array_to_string(c.reloptions, ', '), ' ⏐ '),
                                   '🔴 (موجود وبلا أي خيار — security_invoker ضاعت)') end
          from pg_class c
          where c.relnamespace = 'public'::regnamespace and c.relname = 'stock_document_liveness') as value

union all
select 'view · product_balances' as object,
       'reloptions — expect {security_invoker=true}' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للمنظور أصلًا)'
                     else coalesce(string_agg(array_to_string(c.reloptions, ', '), ' ⏐ '),
                                   '🔴 (موجود وبلا أي خيار)') end
          from pg_class c
          where c.relnamespace = 'public'::regnamespace and c.relname = 'product_balances') as value

union all
select 'function · freeze_consignment_after_use' as object,
       'prosecdef — expect TRUE (inverted from the draft)' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للدالّة أصلًا)'
                     else string_agg(p.prosecdef::text, ' · ') end
          from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'freeze_consignment_after_use') as value

union all
select 'function · freeze_consignment_after_use' as object,
       'proconfig — expect {search_path=public}' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للدالّة أصلًا)'
                     else coalesce(string_agg(array_to_string(p.proconfig, ', '), ' ⏐ '),
                                   '🔴 (بلا إعدادات — search_path غير مثبَّت)') end
          from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'freeze_consignment_after_use') as value

union all
select 'function · freeze_consignment_after_use' as object,
       'raises — expect consignment_flag_locked · consignment_supplier_locked' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للدالّة أصلًا)'
                     else coalesce(string_agg(
                            (select string_agg(x.arr[1], ' · ')
                               from regexp_matches(p.prosrc,
                                      $re$raise\s+(?:exception\s+)?'([a-zA-Z0-9_]+)'$re$,
                                      'gi') as x(arr)), ' ⏐ '),
                          '🔴 (ما بترفع ولا رمز)') end
          from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'freeze_consignment_after_use') as value

union all
select 'trigger · on products' as object,
       'tgtype — expect 19 = ROW + BEFORE + UPDATE' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للمشغّل أصلًا)'
                     else string_agg(t.tgtype::text, ' · ') end
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          where c.relname = 'products' and not t.tgisinternal
            and t.tgname = 'freeze_consignment_after_use') as value

union all
select 'index · stock_documents (reverses_document_id)' as object,
       'UNIQUE and single-column? — the view''s left join depends on it' as fact,
       (select case when count(*) = 0 then '🔴 (ما في ولا فهرس على العمود — والمنظور بيتفرّع بصمت)'
                     else string_agg((i.indisunique and i.indnatts = 1)::text, ' · ') end
          from pg_index i
          join pg_class c on c.oid = i.indrelid
          where c.relname = 'stock_documents'
            and pg_get_indexdef(i.indexrelid) like '%(reverses_document_id)%') as value

union all
select '🔤 arabic · view comment' as object,
       'compared character by character, not displayed' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للمنظور أصلًا)'
                     when bool_or(obj_description(c.oid, 'pg_class') is not distinct from 'لكل مستند: هل هو حيّ — يعني لا هو عكسٌ لغيره ولا حدا عكسه. انوجد لأن نفس السؤال كان رح ينكتب بحارس وبقائمة المستندات وبالتقارير، ونفس الصنف انحرف قبل هيك بين نسختين بجولة وحدة. وبيحمل الجواب عمودًا لا بيصفّي صفوفًا، لأن قائمة المستندات لازم تضلّ تعرض المعكوس وعاكسه. ⚠️ وبينقرأ منه الجواب المنطقيّ (is_live أو exists) وما بينجمع عليه عدد: الوصلة اليسرى ما بتتفرّع إلا لأن في فهرس تفرّد على reverses_document_id مصدرُه ملفّ تاني، ولو راح الفهرس بيرجع المستند مرّتين بلا خطأ بأي مكان — والمنطق ما بيتأثّر والعدّ بيتضاعف بصمت. فالعدّ عليه بـcount(distinct …) أو ما بينعمل.')
                       then '✅ مطابق حرفًا بحرف'
                     else '🔴 مختلف ← ' || coalesce(string_agg(obj_description(c.oid, 'pg_class'), ' ⏐ '), '(بلا تعليق)') end
          from pg_class c
          where c.relnamespace = 'public'::regnamespace and c.relname = 'stock_document_liveness') as value

union all
select '🔤 arabic · function comment' as object,
       'compared character by character, not displayed' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للدالّة أصلًا)'
                     when bool_or(obj_description(p.oid, 'pg_proc') is not distinct from 'حارسان بدالّة وحدة، وكل واحد إله سؤاله. خانة الأمانة بتنقفل لو صار على المنتج أي حركة حيّة — لأن ما في غير هالخانة بيسجّل إن البضاعة كانت لحدا تاني، فقلبُها بيعيد قراءة كل حركة سابقة. والمورّد بينقفل بس وهو أمانة وإله رصيد حيّ — لأن المورّد وقتها صاحب البضاعة الموجودة، وبالمنتج العاديّ هو افتراضٌ للتوريد الجاي لا سجلٌّ للماضي (كل مستند بيحمل مورّده). والحركة الحيّة بتنقرأ من منظور stock_document_liveness، فتوريدٌ انعكس ما بيقفل شي.')
                       then '✅ مطابق حرفًا بحرف'
                     else '🔴 مختلف ← ' || coalesce(string_agg(obj_description(p.oid, 'pg_proc'), ' ⏐ '), '(بلا تعليق)') end
          from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'freeze_consignment_after_use') as value

union all
select '🔤 arabic · hint · consignment_flag_locked' as object,
       'is this exact sentence inside the stored body?' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للدالّة أصلًا)'
                     when bool_or(position('ما بينفع تغيير خانة «منتج أمانة» على منتج تحرّك فعلًا. الحركات السابقة كلها انحسبت على أساس مين صاحب البضاعة، وتغيير الخانة هلأ بيعيد قراءتها بالمقلوب. ولو الخانة انكتبت غلط من البداية: إنشاء منتج جديد بالحالة الصحيحة وأرشفة هذا.' in p.prosrc) > 0)
                       then '✅ موجودة حرفًا بحرف'
                     else '🔴 مش موجودة بالنصّ المخزَّن' end
          from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'freeze_consignment_after_use') as value

union all
select '🔤 arabic · hint · consignment_supplier_locked' as object,
       'is this exact sentence inside the stored body?' as fact,
       (select case when count(*) = 0 then '🔴 (لا وجود للدالّة أصلًا)'
                     when bool_or(position('ما بينفع تبديل المورّد وهذا منتج أمانة لسّه إله رصيد — البضاعة الموجودة ملك المورّد الحالي. تفريغ الرصيد أولًا (نقل أو شطب أو إرجاع للمورّد)، وبعدها التبديل بيصير مسموح.' in p.prosrc) > 0)
                       then '✅ موجودة حرفًا بحرف'
                     else '🔴 مش موجودة بالنصّ المخزَّن' end
          from pg_proc p
          where p.pronamespace = 'public'::regnamespace
            and p.proname = 'freeze_consignment_after_use') as value;
