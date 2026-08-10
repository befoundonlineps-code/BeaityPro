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
-- WHY: so the owner decides on a count and not in the abstract.
--
-- Zero products in the loose state makes it a question about the future. Most
-- of them makes it a question about today. The same rule this project applies
-- to code, applied to a decision.
--
-- ✅ MEASURED: five of eight.
--
--     ✅ للبيع بالعبوة وإله سعر     3   شامبو علاجي · مبرد ومهدئ ليزر · مقشر ليزر
--     🔴 للبيع بالعبوة وبلا سعر     5   باكيج عناية بالشعر · بلسم · تجريبي ·
--                                       سيروم · شامبو 250 مل
--     الشاهد                        8   ✓
--
-- ⇒ Today, not tomorrow. Writing the file paid for itself.
--
-- ---------------------------------------------------------------------------
-- 🔴 AND THE MEASUREMENT THAT MATTERS MOST TO THE DIALOG BUILT FOR THIS:
-- sell_by_packages is TRUE ON ALL EIGHT, and its default is TRUE.
--
-- ⇒ So the box does not distinguish "sold" from "used internally" today. It
-- carries the DEFAULT, not a decision. And a confirmation that fires on a
-- product nobody will ever sell is exactly the "clicked through without
-- reading" this project named as the reason a zero price must not raise it.
--
-- ⚠️ Which of the five actually sell is a question for the owner, and it
-- decides two things: the default, and whether the dialog is a signal or
-- noise. It comes BEFORE shipping, not after.
--
-- ✅ And zero products sell by portion today, so that branch never fires at
-- all — measured, not assumed.
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
