-- ============================================================
-- Marketing · 广告日报 Ad Daily
-- 一行 = 某公司某品牌某天的投放数据。company + brand + date 维度。
-- 数据由 Google Sheet（每个自有品牌一张）每天同步 2 次进来；这里先放
-- 一份样本（Nick 的 2026-06 报表）让页面能显示。Run 一次即可，可重跑。
-- ============================================================
create table if not exists marketing_ad_daily (
  id                    bigint generated always as identity primary key,
  company               text        not null,   -- BM / GWG / GWD
  brand                 text        not null,   -- Fitmode / Slimfinity / LactoDay / BetterDay / Heragen ...
  date                  date        not null,
  shopee_cpas_ads_cost  numeric     not null default 0,
  lazada_cpas_ads_cost  numeric     not null default 0,
  awa_ads_cost          numeric     not null default 0,
  lead_to_pm_ad_cost    numeric     not null default 0,
  new_pm                integer     not null default 0,
  pmed                  integer     not null default 0,
  total_comments        integer     not null default 0,
  new_order             integer     not null default 0,
  repeat_order          integer     not null default 0,
  product_sold          integer     not null default 0,
  fb_new_sales          numeric     not null default 0,
  fb_repeat_sales       numeric     not null default 0,
  insta_new_sales       numeric     not null default 0,
  insta_repeat_sales    numeric     not null default 0,
  shopee_sales          numeric     not null default 0,
  lazada_sales          numeric     not null default 0,
  other_platform_sales  numeric     not null default 0,
  updated_at            timestamptz not null default now(),
  unique (brand, date)              -- 同步按 (brand,date) upsert，不重复
);

alter table marketing_ad_daily enable row level security; -- server 用 service_role 读写，绕过 RLS

-- 样本数据（来自 Nick 2026-06 广告日报截图；品牌暂标 LactoDay/GWG，接同步后以真实为准）
-- on conflict 不动，便于安全重跑。
insert into marketing_ad_daily
  (company, brand, date, shopee_cpas_ads_cost, lazada_cpas_ads_cost, awa_ads_cost, lead_to_pm_ad_cost,
   new_pm, pmed, total_comments, new_order, repeat_order, product_sold,
   fb_new_sales, fb_repeat_sales, insta_new_sales, insta_repeat_sales, shopee_sales, lazada_sales, other_platform_sales)
values
  ('GWG','LactoDay','2026-06-01',29.02,32.29,0,126.70, 8, 8,0, 2,0, 1,   0,  0,0,0, 138.00,   0,0),
  ('GWG','LactoDay','2026-06-02',26.29,25.47,17.89,106.27, 6, 6,1, 0,0, 0,   0,  0,0,0,  69.00,   0,0),
  ('GWG','LactoDay','2026-06-03',19.60,26.96,33.78,100.13, 9, 7,0, 1,0, 2,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-04',28.04,38.92,28.04,102.12,13,11,0, 1,0, 2,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-05',22.28,38.15,26.15, 93.76, 5, 5,0, 1,0, 2,   0,  0,0,0, 237.00,   0,0),
  ('GWG','LactoDay','2026-06-06',16.62,28.11,33.78, 71.65, 3, 3,0, 5,0,35,   0,  0,0,0, 247.50,5103.10,0),
  ('GWG','LactoDay','2026-06-07',25.10,34.77,21.95,131.32, 7, 6,0, 0,0, 0,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-08',25.63,28.70,22.27,145.36, 5, 3,0, 1,0, 3, 447.00,0,0,0,  0,      0,0),
  ('GWG','LactoDay','2026-06-09',27.26,16.07,20.25,144.45,14,12,0, 1,0, 2, 298.00,0,0,0,  0,      0,0),
  ('GWG','LactoDay','2026-06-10',23.92,31.06,19.61,136.68, 9, 9,0, 8,0,15, 745.00,0,0,0, 941.10,329.60,0),
  ('GWG','LactoDay','2026-06-11',19.33,31.78,18.55,106.85, 5, 5,0, 0,1, 2,   0,298.00,0,0,  0,      0,0),
  ('GWG','LactoDay','2026-06-12',26.96,30.82,20.02, 89.27, 9, 5,0, 0,0, 0,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-13',26.45,35.19,17.35, 67.62, 1, 1,1, 1,0, 2, 298.00,0,0,0,  0,      0,0),
  ('GWG','LactoDay','2026-06-14',33.53,28.40,22.13,110.37, 3, 2,0, 3,0, 8,   0,  0,0,0,1008.00,   0,0),
  ('GWG','LactoDay','2026-06-15',24.66,35.00,20.17,118.13,10,10,0, 5,0, 7,   0,  0,0,0,1009.80,   0,0),
  ('GWG','LactoDay','2026-06-16',24.44,35.12,20.19,119.15,10, 7,0, 0,0, 0,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-17',19.87,31.57,19.81,107.33, 2, 2,0, 1,0, 2,   0,  0,0,0, 219.00,   0,0),
  ('GWG','LactoDay','2026-06-18',23.45,31.29,20.17,167.70, 9, 7,0, 0,0, 0,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-19',28.78,26.59,3.99,148.30,12,10,0, 0,0, 0,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-20',0,21.68,0,124.82, 9, 7,0, 0,0, 0,   0,  0,0,0,   0,      0,0),
  ('GWG','LactoDay','2026-06-21',31.39,33.43,0,153.71, 2, 1,0, 3,0,10,   0,  0,0,0,1079.00,338.00,0)
on conflict (brand, date) do nothing;
