-- ============================================================
-- Marketing · 团购 Group Buy（工作流追踪表）
-- 一行 = 一场团购。来自团购总表里「按月份的追踪页签」（May '26 起）。
-- 各月份列略有不同（Target/Expected GMV、Listing Close Date 等）→ 同步按列名匹配。
-- 无天然主键（是工作流追踪，可能重复）→ 同步按 source_month「先删该月再插入」。
-- Run 一次即可。
-- ============================================================
drop table if exists marketing_groupbuy;
create table marketing_groupbuy (
  id                 bigint generated always as identity primary key,
  source_month       text not null,                 -- 来自哪个月份页签，如 '2026-05'
  seq                integer,                        -- 表内序号（#）
  company            text not null default '',
  brand              text not null default '',       -- 偶有多品牌，如 'Melldream + Chaewun'
  start_date         date,
  end_date           date,
  listing_close_date date,
  date_label         text not null default '',       -- 原始日期显示（含 'Long term' 等非日期写法）
  host_name          text not null default '',
  host_type          text not null default '',       -- GROUP BUY / LIVE & GROUP BUY
  sales_platform     text not null default '',
  target_gmv         numeric,                         -- 解析后的数值（50k→50000，1.5 Million→1500000）
  gmv_label          text not null default '',        -- 原始 GMV 文字
  pic                text not null default '',
  done_poster        boolean not null default false,
  done_listing       boolean not null default false,
  done_summary       boolean not null default false,
  check_erp          boolean not null default false,
  promotion_link     text not null default '',
  remark             text not null default '',
  remark_logistic    text not null default '',
  details            jsonb   not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);
alter table marketing_groupbuy enable row level security;
