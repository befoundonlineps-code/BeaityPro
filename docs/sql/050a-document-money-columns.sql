-- ==========================================================================
-- Stage 4 -- money columns on stock_documents
--
-- PREPARED, NOT RUN BY ME. The owner executes it.
-- No RAISE is executed here, no DO block, no temp table.
--
-- Six columns, all nullable: a document with no discount, no freight and no
-- payment is the ordinary case and must not have to say so three times.
--
-- TEXT + CHECK rather than new enum types. A fourth payment method later is
-- then an ALTER of a constraint instead of a new type, and the application
-- already holds the authoritative list in lib/documentMoney.js.
--
-- NO "on account" AMONG THE METHODS, deliberately. The three answer "how did
-- the money move"; deferred payment answers "it did not". One column cannot
-- hold two questions, and forcing it would make part-cash part-deferred --
-- the ordinary case -- impossible to describe. It is derived from
-- paid_amount < net and never stored.
-- ==========================================================================

alter table stock_documents
  add column if not exists discount_kind      text,
  add column if not exists discount_value     numeric(14,2),
  add column if not exists transport_amount   numeric(14,2),
  add column if not exists transport_paid_to  text,
  add column if not exists paid_amount        numeric(14,2),
  add column if not exists payment_method     text;

-- Value guards. NOT NULL is deliberately absent; the CHECKs allow null so an
-- untouched document stays untouched.
alter table stock_documents
  drop constraint if exists stock_documents_discount_kind_check;
alter table stock_documents
  add constraint stock_documents_discount_kind_check
  check (discount_kind is null or discount_kind in ('percent', 'amount'));

alter table stock_documents
  drop constraint if exists stock_documents_transport_paid_to_check;
alter table stock_documents
  add constraint stock_documents_transport_paid_to_check
  check (transport_paid_to is null or transport_paid_to in ('supplier', 'carrier'));

alter table stock_documents
  drop constraint if exists stock_documents_payment_method_check;
alter table stock_documents
  add constraint stock_documents_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'cheque', 'bank_transfer'));

-- Ranges only. A constraint guards the range and a screen guards the meaning --
-- the lesson unit_cost_required taught, so these do not try to be the screen.
alter table stock_documents
  drop constraint if exists stock_documents_money_nonneg_check;
alter table stock_documents
  add constraint stock_documents_money_nonneg_check
  check (coalesce(discount_value, 0) >= 0
     and coalesce(transport_amount, 0) >= 0
     and coalesce(paid_amount, 0) >= 0);

comment on column stock_documents.discount_kind is
  'percent | amount -- how discount_value is read. Applied AFTER the per-line discounts, to what they left.';
comment on column stock_documents.transport_paid_to is
  'supplier | carrier. Freight billed by the supplier is owed to them and belongs in their balance, so our figure matches their invoice -- which is the one job supplier_doc_number has. Freight paid to a carrier still enters unit_cost (a real cost of getting the goods here) and is owed to nobody we track.';
comment on column stock_documents.paid_amount is
  'What was paid AT POSTING. A later payment against an old invoice has no home here and needs the supplier ledger, which does not exist yet.';
comment on column stock_documents.payment_method is
  'How the paid amount moved. Required only when paid_amount > 0, null otherwise. "On account" is NOT a value: it is derived from paid_amount < net, so a part-cash part-deferred document stays describable.';

-- Verification
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'stock_documents'
  and column_name in ('discount_kind','discount_value','transport_amount',
                      'transport_paid_to','paid_amount','payment_method')
order by column_name;
