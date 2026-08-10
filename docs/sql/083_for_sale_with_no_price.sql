-- ==========================================================================
-- 083 -- SURVEY ONLY. Read-only: nothing is written. Safe at any time.
--
-- ⚠️ DEPOSITED AFTER IT RAN, AND WRITTEN BY REVIEW RATHER THAN HERE. The
-- executable text below is verbatim from the run; this header is reconstructed
-- from the reasoning that came with it, so it is NOT byte-identical to the
-- copy the owner executed.
--
-- ⚠️ It is deposited because a script that ran and was never deposited is
-- invisible to every guard in this repository — they read docs/sql and nothing
-- else. That is refuse_archiving_stocked_storage word for word: it lived in the
-- database alone for months, so the guard that refuses a raised code with no
-- sentence could not see the one code in the schema that had none.
--
-- ---------------------------------------------------------------------------
-- WHAT IT MEASURED:
--
--     ✅ للبيع بالعبوة وإله سعر     3   شامبو علاجي · مبرد ومهدئ ليزر · مقشر ليزر
--     🔴 للبيع بالعبوة وبلا سعر     5   باكيج عناية بالشعر · بلسم · تجريبي ·
--                                       سيروم · شامبو 250 مل
--     الشاهد                        8   ✓
--
-- ---------------------------------------------------------------------------
-- 🔴 AND THE CONCLUSION FIRST DRAWN FROM IT IS WITHDRAWN — "five of eight, so
-- this is a question about today rather than the future".
--
-- The owner reports these rows were entered to exercise the system, with no
-- scenario behind them. So the ratio is a property of DATA ENTRY and not of
-- USE, and it cannot say how often this happens in a working salon.
--
-- ⚠️ THE RULE THIS IS THE SECOND INSTANCE OF: this database's rows are test
-- rows. It answers STRUCTURAL questions — does the path exist, does the guard
-- refuse, is the constraint in force — and it answers FREQUENCY questions
-- never. The 28650 was the first (a number that looked like a stock level and
-- was a typing accident); this is the second. Any count taken over it and read
-- as a fact about usage is the substitution this whole thread has been
-- chasing, wearing a number.
--
-- ✅ AND WHAT SURVIVES IS STRONGER THAN WHAT WAS WITHDRAWN: the loose state
-- arose FIVE TIMES WITHOUT ANYBODY INTENDING IT, from somebody filling in
-- fields. So the path needs no intent to be taken, and no layer stops it —
-- which is the whole case for the confirmation, and it does not rest on a
-- frequency nobody knows.
--
-- ⚠️ AND THE SAME CORRECTION APPLIES TO A SECOND COUNT DRAWN FROM THIS FILE:
-- "sell_by_packages is true on all eight, so the box carries the default
-- rather than a decision". On test rows nobody had a reason to untick it, so
-- that is equally a fact about entry. Whether the box will distinguish "sold"
-- from "used internally" in practice is NOT MEASURED — and the deduction that
-- the dialog might therefore be noise is withdrawn with it.
--
-- ⇒ The default for sell_by_packages is DEFERRED, not decided. There is no
-- evidence either way, and the only evidence there could be is real products.
-- Changing it is one line, and it is off the owner's desk until then.
--
-- ✅ And zero products sell by portion, which is why that branch of the dialog
-- does not fire on any row here — the same caveat applies: a fact about these
-- rows, not about salons.
--
-- ⚠️ WITNESS OF TRUTH — item 1ج: row 0 counts the same table in the same
-- query, and the cells below must sum to it. Internal, so nothing is
-- remembered from another query under another filter.
-- ==========================================================================

select '0 · إجمالي المنتجات — شاهدٌ داخليّ، الخلايا تحته لازم تجمع عليه' as package_state,
       '—' as portion_state, count(*) as products, '—' as names
from public.products p

union all

select
  case when p.sell_by_packages and p.package_price is null then '🔴 للبيع بالعبوة — وبلا سعر عبوة'
       when p.sell_by_packages then '✅ للبيع بالعبوة — وإله سعر'
       else '— مش للبيع بالعبوة' end,
  case when p.sell_by_portions and p.portion_price is null then '🔴 للبيع بالحصّة — وبلا سعر حصّة'
       when p.sell_by_portions then '✅ للبيع بالحصّة — وإله سعر'
       else '— مش للبيع بالحصّة' end,
  count(*), string_agg(p.name, ' · ' order by p.name)
from public.products p
group by 1, 2

order by 1, 3 desc, 2;
