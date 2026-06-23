-- ============================================================
-- Marketing · 广告日报 Ad Daily —— 新格式（E-com Report）为标准
-- 一行 = 某公司某品牌某天。新格式品牌(Fitmode)按多平台明细存；
-- 旧 18 栏品牌(LactoDay 等)经「转换器」映射进同一张表的共同字段。
-- source_format 记来源；details(jsonb) 存各格式原始额外字段。
-- 重建：旧表结构不同，先 drop 再建。Run 一次即可。
-- ============================================================
drop table if exists marketing_ad_daily;
create table marketing_ad_daily (
  id              bigint generated always as identity primary key,
  company         text not null,
  brand           text not null,
  date            date not null,
  source_format   text not null default 'new',          -- 'new' | 'old'
  -- 花费（各平台）
  meta_spend      numeric not null default 0,
  shopee_cpas     numeric not null default 0,
  shopee_ads      numeric not null default 0,
  lazada_cpas     numeric not null default 0,
  lazada_ads      numeric not null default 0,
  tiktok_spend    numeric not null default 0,
  total_ad_spend  numeric not null default 0,
  -- 销售（各平台）
  fb_sales        numeric not null default 0,
  ig_sales        numeric not null default 0,
  shopee_sales    numeric not null default 0,            -- = Shopee Total
  lazada_sales    numeric not null default 0,
  tiktok_sales    numeric not null default 0,
  other_sales     numeric not null default 0,
  total_sales     numeric not null default 0,
  -- 订单 / 件数 / 私讯
  total_orders    integer not null default 0,
  total_units     integer not null default 0,
  new_msg         integer not null default 0,
  total_msg       integer not null default 0,
  details         jsonb   not null default '{}'::jsonb,  -- 原始额外字段（旧:awa/pmed/comments；新:net/cumul 等）
  updated_at      timestamptz not null default now(),
  unique (brand, date)
);
alter table marketing_ad_daily enable row level security;

-- 样本① Fitmode（新格式，真实 6 月）
insert into marketing_ad_daily (company,brand,date,source_format,meta_spend,shopee_ads,total_ad_spend,shopee_sales,total_sales,total_orders,total_units) values
('BM','Fitmode','2026-06-14','new',0,192,192,1452,1452,12,12),
('BM','Fitmode','2026-06-15','new',0,192,192,1170,1170,5,5),
('BM','Fitmode','2026-06-17','new',0,192,192,823,823,4,4),
('BM','Fitmode','2026-06-18','new',0,192,192,906,906,6,6),
('BM','Fitmode','2026-06-19','new',43,191,234,566,566,3,3),
('BM','Fitmode','2026-06-21','new',111,180,292,406,406,3,3);

-- 样本② LactoDay（旧格式 → 转换器映射，真实 6 月代表性日子）
insert into marketing_ad_daily (company,brand,date,source_format,meta_spend,shopee_cpas,lazada_cpas,total_ad_spend,fb_sales,shopee_sales,lazada_sales,total_sales,total_orders,total_units,new_msg,total_msg,details) values
('GWG','LactoDay','2026-06-01','old',126.70,29.02,32.29,188.01,0,138.00,0,138.00,2,1,8,8,'{"awa":0}'::jsonb),
('GWG','LactoDay','2026-06-06','old',71.65,16.62,28.11,150.16,0,247.50,5103.10,5350.60,5,35,3,3,'{"awa":33.78}'::jsonb),
('GWG','LactoDay','2026-06-10','old',136.68,23.92,31.06,211.27,745.00,941.10,329.60,2015.70,8,15,9,9,'{"awa":19.61}'::jsonb),
('GWG','LactoDay','2026-06-14','old',110.37,33.53,28.40,194.43,0,1008.00,0,1008.00,3,8,3,3,'{"awa":22.13}'::jsonb),
('GWG','LactoDay','2026-06-15','old',118.13,24.66,35.00,197.96,0,1009.80,0,1009.80,5,7,10,10,'{"awa":20.17}'::jsonb),
('GWG','LactoDay','2026-06-21','old',153.71,31.39,33.43,218.53,0,1079.00,338.00,1417.00,3,10,2,2,'{"awa":0}'::jsonb);
