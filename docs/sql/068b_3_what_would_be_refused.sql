-- ==========================================================================
-- 068b · QUERY 3 of 3 -- VERIFICATION ONLY. Read-only: NOTHING IS WRITTEN.
--
-- RUN AFTER 068a.
--
-- ⚠️ THE ONE WORTH READING TWICE.
--
-- ---------------------------------------------------------------------------
-- WHY: the trigger's own condition, run against live data without deleting
-- anything. It answers "which un-ticks would be refused today" BEFORE anybody
-- opens the storage window and finds out one at a time.
--
-- ⚠️ AND IT IS A DRY RUN OF THE GUARD, NOT A TEST OF THE TRIGGER. The trigger
-- firing is proved by an actual refused delete, which is the owner's to try
-- from the screen once it exists. This proves the CONDITION selects the right
-- rows — the same split as 056d_6, which ran the fine's resolution without
-- writing a fine.
--
-- WHAT TO LOOK AT:
--   • rows where would_be_refused = true — these are links that cannot be
--     removed until the shelf is cleared. Right after the seed most links have
--     no stock behind them, so a short list is expected and a long one is
--     information rather than a problem.
--   • ⚠️ A row here is ALSO the answer to "where is stock hiding". After the
--     first un-ticking, 067_1 becomes the detection tool for stranded goods —
--     it deliberately does not join storage_categories, so it reads the whole
--     class rather than the linked part. This query is the same question asked
--     before the damage instead of after.
-- ==========================================================================

select
  s.name                                          as storage_name,
  c.name                                          as folder_name,
  sc.seeded                                       as still_default,
  count(*) filter (where b.balance_base <> 0)     as products_with_stock,
  string_agg(p.name, ' · ' order by p.name)
    filter (where b.balance_base <> 0)             as which,
  count(*) filter (where b.balance_base <> 0) > 0 as would_be_refused
from public.storage_categories sc
join public.storages s          on s.id = sc.storage_id  and s.salon_id = sc.salon_id
join public.product_categories c on c.id = sc.category_id and c.salon_id = sc.salon_id
left join public.products p      on p.category_id = sc.category_id and p.salon_id = sc.salon_id
left join public.product_balances b
  on b.product_id = p.id
 and b.storage_id = sc.storage_id
 and b.salon_id   = sc.salon_id
group by s.id, s.name, c.id, c.name, sc.seeded
order by would_be_refused desc, s.name, c.name;
