-- ==========================================================================
-- 067 · QUERY 1 of 3 -- SURVEY ONLY. Read-only: nothing is written.
--
-- PREPARED, NOT RUN BY ME. Safe at any time.
--
-- ⚠️ WRITTEN AFTER THE FACT, AND THAT IS THE POINT OF FILING IT.
--
-- Three measurements were reported in review and the catalogue screen was
-- designed on top of them — that balances are real and per storage, that the
-- document types are nine with four written by the system, and that
-- product_orders carries no storage. The queries that produced them were never
-- deposited here, so the screen's foundations lived in a conversation while
-- 053–063 lived in this folder.
--
-- ⚠️ These three files are therefore NOT a record of a measurement that
-- happened; they are the questions, written so the answers can be recorded the
-- way every other answer in this folder was. What is reported below is marked
-- as reported. When the owner runs them, docs/sql/README.md gets the results
-- and the claims stop being second-hand.
--
-- ---------------------------------------------------------------------------
-- WHY THIS ONE: the catalogue's balance column, and the decision that a product
-- with no movements shows 0 rather than a dash.
--
-- That decision rests entirely on movements being the ledger. If there were few
-- or none, zero would be a claim rather than an answer, and the old comment in
-- ProductsBrowser.js — "a balance is the sum of stock movements and there are
-- none, so the honest answer today is unknown" — would still be right.
--
-- REPORTED (unverified here): 31 movements across 7 of 8 products.
--
-- ⚠️ PER STORAGE AND PER PRODUCT, not a total. A grand total says movements
-- exist; it does not say the balance column has anything to show in the storage
-- somebody is looking at. And the left join is what makes a product with NO
-- movements appear as a zero row rather than vanish — the vanishing is what
-- would make the screen honest-looking and wrong.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND THE FIRST DRAFT OF THIS FILE CONTAINED THE FAULT THE PARAGRAPH ABOVE
-- WARNS ABOUT, FOURTEEN LINES BELOW IT: `and p.kind = 'product'`.
--
-- Every SET disappeared — no zero, no row, no mention. One vanishing was
-- guarded against and the other was manufactured in the same query. And the
-- catalogue draws sets: the mockup's "طقم الترطيب الكامل" carries a balance and
-- two badges, so the survey that decides what the balance column can show would
-- not have covered every row the screen draws. Sixteen rows returning as
-- fourteen says nothing about the two that left.
--
-- ⚠️ WORSE, IT DECIDED THE QUESTION INSTEAD OF MEASURING IT. "Does a set carry
-- stock?" is an answer this screen needs: if a set is assembled at the point of
-- sale it has no balance of its own, and the catalogue must then show it NO
-- number at all — the mockup shows 4.0, which would be wrong. If it does carry
-- stock, the row is legitimate. The filter made the question unanswerable, and
-- it is the question that decides what gets drawn.
--
-- So the filter is gone and `p.kind` is a COLUMN. The survey now says how many
-- sets exist and whether any of them has ever moved, which together are the
-- answer.
--
-- ---------------------------------------------------------------------------
-- ⚠️ AND IT DOES NOT JOIN storage_categories — DELIBERATELY, AND THIS BECOMES
-- ITS SECOND JOB.
--
-- Every product is listed against every storage whether its folder is linked
-- there or not. That is correct for a survey: it reads the whole class rather
-- than the part somebody expects, which is the rule this folder keeps arriving
-- at from a different direction each time.
--
-- Today that only means some rows are zero and uninteresting. ⚠️ From the first
-- un-ticking onward it is the ONLY query that can see stranded stock — goods
-- sitting in a storage whose folder was unlinked, invisible to the tree and
-- unreachable by transfer. A version that joined storage_categories would show
-- exactly the rows the screen already shows and would be blind to precisely the
-- case worth finding.
--
-- 068a refuses to create that state; 068b_3 lists which un-ticks it would
-- refuse. This one reads the damage if any ever gets past them.
-- ==========================================================================

select
  s.name                                   as storage_name,
  p.name                                   as product_name,
  p.kind                                   as product_kind,
  count(m.id)                              as movements,
  coalesce(sum(m.quantity_base), 0)        as balance_base,
  p.base_unit,
  p.units_per_package
from public.storages s
cross join public.products p
left join public.stock_movements m
  on m.storage_id = s.id
 and m.product_id = p.id
 and m.salon_id   = s.salon_id
where p.salon_id = s.salon_id
group by s.id, s.name, p.id, p.name, p.kind, p.base_unit, p.units_per_package
order by s.name, p.kind, p.name;
