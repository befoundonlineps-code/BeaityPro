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
-- ==========================================================================

select
  s.name                                   as storage_name,
  p.name                                   as product_name,
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
  and p.kind = 'product'
group by s.id, s.name, p.id, p.name, p.base_unit, p.units_per_package
order by s.name, p.name;
