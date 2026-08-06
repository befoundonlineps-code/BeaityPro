-- ==========================================================================
-- 052b -- CHANGE ONLY. No SELECT in this file. Run AFTER 052a returns zero rows.
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
--
-- ⚠️ THE FIRST SCRIPT WRITTEN UNDER THE SEPARATION RULE: the change is here and
-- the verification is in 052c, in its own paste. 051c ended with a verification
-- query that was invalid, and because the editor runs a file as one transaction
-- the refusal rolled back the CREATE OR REPLACE above it. Nothing in this file
-- can report anything, so nothing in this file can undo anything.
--
-- RUN ORDER: 052a (survey) -> 052b (this) -> 052c (verification).
--
-- ---------------------------------------------------------------------------
-- A CONSTRAINT AND NOT A GUARD IN THE FUNCTION, and the difference is the point
--
-- CLAUDE.md's rule for where a write is protected: a CHECK when the rule is
-- about the validity of ONE ROW, a function when it is about a relationship
-- between writes. This is the first kind — every input it needs is on the row —
-- so it covers every path, including one that never calls post_stock_document.
--
-- ⚠️ That is exactly why bonus_supply_only could NOT be a constraint: it needs
-- doc_type, which lives on stock_documents, and a CHECK cannot read another
-- table. The two rules look alike and belong in different places, and the
-- reason is which table holds the facts.
--
-- ---------------------------------------------------------------------------
-- WHAT IT REFUSES, AND THE THIRD CASE THAT IS NOT OBVIOUS
--
--  1. percent above 100 — a net below zero.
--  2. amount above the line's gross — the same, by the other road.
--  3. ⚠️ a discount VALUE with no KIND. 050b allows the kind to be null (an
--     undiscounted line has neither), and the PAIR is what has to be complete:
--     a value read "according to line_discount_kind" with no kind is a number
--     nobody can interpret, and 10 read as an amount instead of a percent on a
--     line of 500 is 490 instead of 450.
--
--     ⚠️ AND THE FIRST DRAFT OF THIS FILE DID NOT ENFORCE IT, though it read as
--     though it did — caught in review. `line_discount_kind = 'percent'` on a
--     NULL kind is UNKNOWN, not false; both branches went UNKNOWN, the whole
--     expression went UNKNOWN, and a CHECK rejects only on FALSE.
--
--     ⚠️ And the failure was worst exactly where it mattered, measured over the
--     full case set:
--
--       value 300, kind NULL  ->  REJECTED   (both branches reach FALSE anyway)
--       value  10, kind NULL  ->  ACCEPTED   (the ambiguous one, and the point)
--
--     The absurd value was caught by accident and the plausible one let
--     through — so the constraint caught the case nobody would write and
--     missed the case it was written for.
--
-- The gross is (received - bonus) * price: the SAME expression the screen and
-- lib/documentMoney.js use, because the free goods are not charged for. Written
-- differently here it would refuse valid bonus lines.
--
-- abs(entered_quantity) because the sign of a movement lives in quantity_base
-- and entered_quantity is stored positive on issues too — and defensively, so
-- this does not become wrong if that ever changes.
--
-- ⚠️ Reversals are unaffected: reverse_stock_document copies all four of these
-- columns unchanged, so a row that satisfied this constraint still satisfies it
-- after being copied. Only quantity_base is negated, and this does not read it.
-- ==========================================================================

alter table public.stock_movements
  drop constraint if exists stock_movements_line_discount_within_line_check;

alter table public.stock_movements
  add constraint stock_movements_line_discount_within_line_check
  check (
    line_discount_value is null
    -- ⚠️ THE PAIRING IS ITS OWN CONJUNCT, AND IT HAS TO BE. Written as two
    -- branches alone, a value with a NULL kind made every branch UNKNOWN rather
    -- than false, and a CHECK rejects only on FALSE — so the row was accepted.
    -- `line_discount_kind is not null` returns false definitively, which is
    -- what turns the whole expression false.
    --
    -- It governs both branches from one place, so a third kind added later
    -- cannot arrive unguarded. Guarding each comparison instead — coalesce on
    -- every one of them — is equally correct today and one forgotten wrapper
    -- away from this exact hole tomorrow.
    or (line_discount_kind is not null
        and (
          (line_discount_kind = 'percent' and line_discount_value <= 100)
          or (line_discount_kind = 'amount'
              and entered_unit_price is not null
              and entered_quantity is not null
              and line_discount_value
                  <= (abs(entered_quantity) - coalesce(bonus_quantity, 0)) * entered_unit_price)
        ))
  );
