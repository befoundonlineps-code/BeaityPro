-- ==========================================================================
-- 079b_2 -- SURVEY ONLY. Read-only: nothing is written.
--
-- RUN AFTER 079a. Every row is a property that CREATE OR REPLACE can drop
-- silently, plus the Arabic read back out of the database.
--
-- ---------------------------------------------------------------------------
-- WHY EACH ROW IS HERE — none of them is decoration:
--
-- security_invoker on the view   CLAUDE.md item 6. `create or replace view`
--                                without WITH resets options to their
--                                defaults, and the failure is INVISIBLE while
--                                one salon exists — which is exactly now. A
--                                view running with its owner's rights shows
--                                every salon's documents to every salon.
--                                Expected: {security_invoker=true}
--
-- product_balances too           It is read by this trigger and by two others.
--                                It has not been re-created here, so this row
--                                is a free re-measurement of something nothing
--                                in this round touched. If it has drifted, we
--                                want to know from a row rather than from a
--                                second salon.
--
-- prosecdef = true               ⚠️ THE EXPECTATION IS INVERTED FROM THE
--                                DRAFT. 079a converts the function to
--                                SECURITY DEFINER, so `false` is now the
--                                failure. Written down because the tempting
--                                "fix" for a future reader is reverting it to
--                                invoker, which fails toward PERMISSION: the
--                                sums come back zero and the change is allowed
--                                — the one case the guard exists to refuse.
--
-- proconfig                      Expected: {search_path=public}. A definer
--                                function owned by postgres resolves
--                                unqualified names through the CALLER's path,
--                                and its owner bypasses RLS (measured in
--                                068b_1).
--
-- tgtype = 19                    ROW(1) + BEFORE(2) + UPDATE(16). BEFORE
--                                matters: an AFTER trigger raising here would
--                                still refuse, but the fired-on-every-column
--                                cost is paid before the row is written.
--
-- raises                         The two codes read off the stored body rather
--                                than off this file. lib/raisedCodes.js must
--                                name both, and lib/raisedCodes.test.js reads
--                                docs/sql to enforce it — but it reads the
--                                FILE. This row reads the DATABASE, which is
--                                the only place the two can disagree.
--
-- the unique index               ⚠️ NOT ORNAMENT. The view's left join cannot
--                                fan out only because 045 put a single-column
--                                UNIQUE index on reverses_document_id — and
--                                until this row runs, that is a claim made by
--                                a script about what it intended, not a fact
--                                read from the catalogue. Exactly the class
--                                CLAUDE.md item 4ب names: ask the catalogue,
--                                not the memory. Expected: TRUE.
--
-- the Arabic                     CLAUDE.md: any script depositing Arabic reads
--                                it back, because it lives somewhere our test
--                                suite cannot see — our tests read files, and
--                                this text is in the database. Eighteen
--                                sentences were silently TRANSLATED once when
--                                an encoding fix overreached, and nothing here
--                                could have noticed.
--
--                                ⚠️ AND THE HINTS DO NOT REACH A USER — an
--                                earlier draft of this file said they did, and
--                                our own measurement says otherwise.
--                                dbErrorSentence takes the named key FIRST and
--                                throws the hint away (068a). Both new codes
--                                have keys, so the hints now reach whoever
--                                opens the logs or reads the function — which
--                                is a real audience and a different one. It
--                                matters because somebody who believes the
--                                hint is the user-facing sentence will spend
--                                on it the care the locale file deserves, and
--                                under-write the sentence that actually shows.
--
-- ⚠️ ONE QUERY, NOT SEVEN. The Supabase editor returns only the LAST result
-- set of a multi-statement script, so seven statements would print one answer
-- and hide six. That is why every file in this series carries one query.
-- ==========================================================================

select 'view · stock_document_liveness' as object,
       'reloptions — expect {security_invoker=true}' as fact,
       coalesce(array_to_string(c.reloptions, ', '), '⚠️ (none)') as value
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname = 'stock_document_liveness'

union all
select 'view · product_balances',
       'reloptions — expect {security_invoker=true}',
       coalesce(array_to_string(c.reloptions, ', '), '⚠️ (none)')
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname = 'product_balances'

union all
select 'function · freeze_consignment_after_use',
       'prosecdef — expect TRUE (inverted from the draft)',
       p.prosecdef::text
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'freeze_consignment_after_use'

union all
select 'function · freeze_consignment_after_use',
       'proconfig — expect {search_path=public}',
       coalesce(array_to_string(p.proconfig, ', '), '⚠️ (none)')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'freeze_consignment_after_use'

union all
select 'function · freeze_consignment_after_use',
       'raises — expect consignment_flag_locked · consignment_supplier_locked',
       coalesce(
         (select string_agg(x.arr[1], ' · ')
            from regexp_matches(
                   p.prosrc,
                   $re$raise\s+(?:exception\s+)?'([a-zA-Z0-9_]+)'$re$,
                   'gi'
                 ) as x(arr)),
         '⚠️ (none)')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'freeze_consignment_after_use'

union all
select 'trigger · on products',
       'tgtype — expect 19 = ROW + BEFORE + UPDATE',
       t.tgtype::text
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'products'
  and not t.tgisinternal
  and t.tgname = 'freeze_consignment_after_use'

union all
select 'index · stock_documents (reverses_document_id)',
       'is it UNIQUE and single-column? — the view''s left join depends on it',
       (i.indisunique and i.indnatts = 1)::text
from pg_index i
join pg_class c on c.oid = i.indrelid
where c.relname = 'stock_documents'
  and pg_get_indexdef(i.indexrelid) like '%(reverses_document_id)%'

union all
select '🔤 arabic · view comment',
       'read back out of the database',
       coalesce(obj_description(c.oid, 'pg_class'), '⚠️ (none)')
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname = 'stock_document_liveness'

union all
select '🔤 arabic · function comment',
       'read back out of the database',
       coalesce(obj_description(p.oid, 'pg_proc'), '⚠️ (none)')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'freeze_consignment_after_use'

union all
select '🔤 arabic · the two hints',
       'read back — these reach a human being',
       coalesce(
         (select string_agg(x.arr[1], '   ⏐   ')
            from regexp_matches(p.prosrc, $re$using hint = '([^']+)'$re$, 'g') as x(arr)),
         '⚠️ (none)')
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'freeze_consignment_after_use';
