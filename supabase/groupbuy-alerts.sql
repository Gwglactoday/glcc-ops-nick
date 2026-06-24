-- ============================================================
-- 团购通知防重复表
-- 记录「开 Listing」通知已发过哪些（只发一次）。预警是每天发，不入此表。
-- Run 一次即可（用 create if not exists，重复跑也安全）。
-- ============================================================
create table if not exists groupbuy_alerts (
  alert_key  text primary key,   -- 'listing|' + source_month|brand|host_name|start_date
  alert_type text not null,      -- 'listing'
  sent_at    timestamptz not null default now()
);
alter table groupbuy_alerts enable row level security;
