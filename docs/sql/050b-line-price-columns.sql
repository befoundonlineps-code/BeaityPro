-- ==========================================================================
-- Stage 4 -- the typed price and its discount, on stock_movements
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No RAISE is executed here, no DO block, no temp table.
--
-- WHY THESE ARE STORED AND NOT FOLDED AWAY. From the final unit_cost the two
-- typed numbers cannot be recovered: one number does not split back into a
-- price and a discount. The information is lost at posting, not at display.
--
-- It is the entered_quantity lesson on the other half of the line. 75 could
-- not tell the owner he had entered 5 packages, so both columns stayed. A
-- landed unit_cost cannot tell anybody the invoice said 100 with 10% off.
--
-- THE NET IS NOT STORED. It follows from the two, and a third stored number
-- is a third thing that can disagree with them.
--
-- FRAME: entered_unit_price is per ENTERED unit -- per package if that is
-- what was typed -- while unit_cost is per BASE unit. On a product of 15 per
-- package they are 100 and 6.6667 for the same thing (item 35).
--
-- Left null by transfer_stock and post_stocktake, correctly: nobody types a
-- price on either, so there is no discount to describe.
-- ==========================================================================

alter table stock_movements
  add column if not exists entered_unit_price   numeric(14,4),
  add column if not exists line_discount_kind   text,
  add column if not exists line_discount_value  numeric(14,2);

alter table stock_movements
  drop constraint if exists stock_movements_line_discount_kind_check;
alter table stock_movements
  add constraint stock_movements_line_discount_kind_check
  check (line_discount_kind is null or line_discount_kind in ('percent', 'amount'));

alter table stock_movements
  drop constraint if exists stock_movements_line_money_nonneg_check;
alter table stock_movements
  add constraint stock_movements_line_money_nonneg_check
  check (coalesce(entered_unit_price, 0) >= 0
     and coalesce(line_discount_value, 0) >= 0);

comment on column stock_movements.entered_unit_price is
  'The price as written on the invoice, per ENTERED unit (per package if that is what was typed). unit_cost is the landed cost per BASE unit and is a different number: on a product of 15 per package they are 100 and 6.6667 for the same thing. Stored because a landed unit_cost cannot say what the invoice said.';
comment on column stock_movements.line_discount_value is
  'A discount on this line alone, read according to line_discount_kind. The net is NOT stored: it follows from these two, and a third stored number is a third thing that can disagree.';

-- Verification
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'stock_movements'
  and column_name in ('entered_unit_price','line_discount_kind','line_discount_value')
order by column_name;
