-- ==========================================================================
-- 053d -- CHANGE ONLY. No SELECT in this file. Verification is 053e.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- RUN ORDER: 053a (done) -> 053b (done) -> 053c (done) -> 053d (this) -> 053e.
--
-- ---------------------------------------------------------------------------
-- ONE FACT, ONE PLACE. 053a stated it twice.
--
-- 053c measured what 053a had to write around: entry_uom is a real enum
-- (typtype = 'e') whose labels are package, portion, unit -- the same three
-- 053a listed by hand in a CHECK. So the order lines and the movements now
-- describe the identical rule in two different languages:
--
--   stock_movements.entered_uom      USER-DEFINED / entry_uom
--   product_order_lines.entered_uom  text + a three-literal CHECK
--
-- ⚠️ AND THAT IS THE salon_id FAULT AGAIN, one column to the left. Two copies
-- of a rule agree the day they are written -- they were measured agreeing an
-- hour ago -- and diverge the day one of them learns something. A fourth label
-- added to entry_uom would be accepted by every supply row and refused by every
-- order row, and nothing anywhere connects the two statements.
--
-- ⚠️ It is also the reason to do it NOW rather than note it: the table is
-- empty. `alter column type` on an empty table is instant and cannot fail on
-- data. The same ALTER after the order screens have been used has to convert
-- every stored row, and a single unconvertible value turns a one-line change
-- into an incident.
--
-- ---------------------------------------------------------------------------
-- WHAT DOES NOT CHANGE, SAID SO NOBODY "FIXES" IT LATER
--
-- NOT NULL stays. An order line is always typed by a person in a unit they
-- chose, and there is no stocktake-shaped row in this table -- which is exactly
-- why stock_movements.entered_uom is nullable and this one is not. 053c query 2
-- settled that with data: the null rows are `stocktake` and nothing else, 2 of
-- them, no supply, no write_off, no return, no transfer. The two columns differ
-- ON PURPOSE and this ALTER must not level them.
--
-- ALTER COLUMN TYPE preserves NOT NULL by itself. It is named here because a
-- reader comparing the two tables afterwards will see one nullable and one not,
-- and the question deserves an answer where it will be looked for.
--
-- ---------------------------------------------------------------------------
-- THE CHECK GOES FIRST, AND THE ORDER MATTERS
--
-- Left in place, `entered_uom in ('package','portion','unit')` would very
-- probably survive the type change -- the literals coerce to the enum and the
-- constraint re-validates. Surviving is the problem, not the risk: it would
-- leave the duplication this file exists to remove, now dressed as agreement
-- with the enum rather than as a second copy of it.
-- ==========================================================================

alter table public.product_order_lines
  drop constraint if exists product_order_lines_uom_check;

alter table public.product_order_lines
  alter column entered_uom type public.entry_uom
  using entered_uom::public.entry_uom;

comment on column public.product_order_lines.entered_uom is
  'The enum entry_uom, the same type stock_movements.entered_uom uses, so the permitted units are stated once in the database rather than restated here. 053a first wrote this as text plus a CHECK listing the three labels by hand; 053c measured the type and 053d aligned it. ⚠️ NOT NULL here while the movements column is nullable, and that difference is deliberate: a stocktake movement is a computed difference nobody typed a unit for, and no row of that shape exists in this table.';
