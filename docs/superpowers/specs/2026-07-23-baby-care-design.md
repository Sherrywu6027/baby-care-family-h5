# 宝宝照顾记录应用 · 设计方案（MVP）

- 日期：2026-07-23
- 状态：已与用户确认（默认风格：清爽工具系 + 柔和马卡龙；倒计时卡靛蓝渐变）
- 形态：手机网页 PWA + Supabase 云端同步

---

## 1. 目标（Goals）

为新手父母提供一个**单手可操作、离线可记、多设备共享**的宝宝日常照顾记录工具。

核心记录类型（默认 6 类）：换尿片、奶粉、母乳瓶喂、母乳亲喂、睡眠、吸奶。
换尿片记录支持可选填写 **大便量 1-5**，用于更细的观察与回看。
原“健康”入口调整为 **体重记录**：记录体重（kg）并按宝宝月龄提供**中国常用婴幼儿生长参考体重**对比。
核心计算能力：距上次喝奶倒计时、今日汇总（喝奶总量/次数、睡眠总时长、尿片数）、吸奶/亲喂/睡眠计时。
数据共享：通过「家庭码」让爸妈多台设备共享同一份记录，换手机不丢。

## 2. 非目标（Non-Goals / MVP 暂不做）

- 喝奶提醒推送（定时通知）
- 多语言 / i18n
- 图表导出为图片
- SaaS 多租户账号体系、付费
- 拖拽排序首页按钮（MVP 按添加顺序排，后续再加）

## 3. 架构

```
┌─────────────────────────────────────────┐
│  手机浏览器（PWA，可加到主屏）          │
│  ├─ 前端：原生 HTML/JS 模块 + hash 路由 │
│  └─ 本地存储：IndexedDB（即时落库）     │
└───────────────┬───────────────────────┘
                 │ 联网后增量同步（按 updated_at）
                 ▼
┌─────────────────────────────────────────┐
│  Supabase（Postgres + Auth + RLS）       │
│  ├─ families / members / babies / events │
│  └─ 行级权限：按 family_id 隔离         │
└─────────────────────────────────────────┘
```

- **前端零构建**：不引入 npm/打包，直接 `index.html` 打开即用。
- **离线优先**：任何记录先写 IndexedDB，UI 立即响应；联网后后台同步到 Supabase。
- **同步冲突**：最后写入胜（last-write-wins），单人高频记录冲突概率极低。

## 4. 技术栈

| 层 | 选择 | 说明 |
|---|---|---|
| 前端 | 原生 HTML + CSS + ES Modules | 零构建、零依赖 |
| 路由 | 极简 hash 路由（`#/today` 等） | 无框架 |
| 本地库 | IndexedDB（封装 `db.js`） | 离线缓存 + 同步队列 |
| 后端 | Supabase（免费档） | Postgres + Auth + RLS |
| 客户端 | `@supabase/supabase-js`（CDN 引入） | 避免打包 |
| 安装 | PWA：`manifest.webmanifest` + `sw.js` | 加到主屏、离线可用 |

## 5. 数据模型（Supabase Postgres）

```sql
-- 家庭组：一台设备创建，生成 6 位共享码
families (
  id uuid pk,
  code text unique,        -- 6 位共享码
  created_at timestamptz
)

-- 成员设备/用户：匿名或魔法邮件登录，绑定家庭
members (
  id uuid pk,
  family_id uuid fk,
  auth_user uuid,          -- Supabase auth.uid()
  role text default 'parent'
)

-- 宝宝档案：支持多宝宝
babies (
  id uuid pk,
  family_id uuid fk,
  name text,               -- 小名，如「豆豆」
  birthday date,
  avatar text,             -- emoji 或图片 url
  sort int
)

-- 核心记录
events (
  id uuid pk,
  family_id uuid fk,
  baby_id uuid fk,
  type text,               -- diaper|formula|milk_bottle|milk_direct|sleep|pump|health
  start_time timestamptz,  -- 记录时间（默认现在，可改）
  end_time timestamptz,    -- sleep/pump 计时结束；其余可空
  amount_ml int,           -- formula/milk_bottle/pump 容量
  duration_min int,        -- milk_direct 亲喂时长 / sleep 时长
  stool bool default false, -- diaper 是否大便 💩
  stool_amount int,        -- diaper 大便量（1-5，可选）
  note text,               -- 乳糖酶、体温、用药等
  created_at timestamptz,
  updated_at timestamptz,
  sync_status text default 'local' -- local|synced
)
```

**RLS（行级安全）**：`families` / `members` / `babies` / `events` 全部按 `family_id = current_family()` 过滤，仅同家庭成员可读写。`current_family()` 通过 `members` 表关联 `auth.uid()` 解析。

## 6. 首页（今日页）UX

顶部：日期 + **宝宝切换**（下拉/横滑切换多宝宝）。

**距上次喝奶倒计时**（醒目卡，默认靛蓝渐变）：
- 取最近一条 `type ∈ {formula, milk_bottle, milk_direct}` 的 `start_time`，实时算 `now − 该时间`。
- 无记录时显示「—」。
- 喂奶/亲喂后自动重置。

**今日汇总**（三块）：喝奶总 ml / 次数、睡眠总时长、尿片数（健康次数可选显示）。

**进行中计时芯片**：吸奶或睡眠进行中时显示跑表，点「结束」存记录。

**可自定义快捷记录按钮**：
- 默认 6 个：💧换尿片 / 🍼奶粉 / 🥛母乳瓶喂 / 😋母乳亲喂 / 😴睡眠 / ⏱吸奶。
- 「设置 → 首页按钮」可增删；**体重**作为可添加备选项，默认隐藏，勾选后出现在首页。
- MVP 顺序按添加顺序排（拖拽排序后续再做）。
- 点按钮 → 弹出轻量记录表单：默认当前时间（可改），按类型显隐字段（ml / 时长 / 大便量图标 0-5 / 备注）。

## 7. 记录页 & 统计页

- **记录页**：时间线倒序，可按类型筛选、编辑、删除；亲喂记录显示总时长与左右胸明细，并支持分别编辑左右胸时长后自动重算总时长。
- **统计页**：日 / 周 / 月趋势——喝奶量曲线、睡眠总时长、喂养次数、尿片数；**体重记录**显示当前宝宝年龄对应的中国常用婴幼儿参考体重区间，便于对比。

## 8. 计时能力（明确需求）

- **吸奶计时**：点「吸奶」开始走表 → 可填目标容量 → 点结束存 `duration_min` + `amount_ml`。
- **母乳亲喂**：默认进入跑表页，先选左/右胸后开始；中途可一键切到另一边；结束后自动保存 `left_min` / `right_min` / `duration_min`，也支持手动补录左右胸时长。
- **睡眠**：记起止时间 → 自动算时长；也支持「开始睡 / 醒来」计时模式。

## 9. 计算逻辑（前端实时算，不依赖后端）

- `距上次喝奶 = now − 最近喂奶类记录 start_time`
- `睡眠总时长 = Σ(当日 sleep 的 end_time − start_time)`
- `喝奶总量 = Σ(当日 formula + milk_bottle 的 amount_ml)`（亲喂无 ml，记时长）
- `喂养次数 = 当日 formula + milk_bottle + milk_direct 条数`
- 所有计算纯前端，离线也能显示（基于本地 IndexedDB 数据）。

## 10. 同步 & 多设备

- 本地先写 IndexedDB（离线可记），联网后按 `updated_at` 增量同步到 Supabase。
- **家庭码共享**：一台建家庭 → 生成 6 位码；另一台输码加入 → 同 `family_id`。
- **登录方式**：默认**匿名登录**（Supabase Anonymous Sign-ins），可改魔法邮件链接，零密码。
- **冲突处理**：last-write-wins。

## 11. 导出 / 导入备份（纯本地兜底）

- 导出全部记录为 JSON（含 babies / family 元信息），可存手机或云盘。
- 导入 JSON 恢复 / 合并（按 `id` upsert，避免重复）。

## 12. 视觉规范（默认）

- 风格：**清爽工具系 + 柔和马卡龙色块按钮**（即原型风格）。
- 倒计时卡：**靛蓝渐变**（可改素色，预留 CSS 变量）。
- 字体：系统字体栈；主色 `#6366f1`，辅以各类型柔和底色。
- 适配：移动端优先，单列布局，大点按区域。

## 13. 文件结构（实现期参考）

```
/index.html
/manifest.webmanifest
/sw.js
/css/styles.css
/js/config.js          # 用户填入 SUPABASE_URL / SUPABASE_ANON_KEY
/js/app.js             # 路由 + 启动
/js/db.js              # IndexedDB 封装 + 同步队列
/js/sync.js            # Supabase 增量同步
/js/calc.js            # 计算逻辑
/js/timer.js           # 吸奶/睡眠计时
/js/ui-today.js
/js/ui-log.js
/js/ui-stats.js
/js/ui-settings.js     # 宝宝管理 / 按钮自定义 / 家庭码 / 导出导入
/supabase/schema.sql   # 建表 + RLS
```

## 14. 实现里程碑（粗）

1. Supabase 项目 + `schema.sql`（建表 + RLS）+ 用户填 `config.js`。
2. PWA 壳 + 路由 + IndexedDB 本地写入（离线可记）。
3. 首页：倒计时 + 汇总 + 自定义按钮 + 记录表单。
4. 计时（吸奶/亲喂/睡眠）。
5. 记录页 + 统计页。
6. 同步（家庭码 + 增量同步）+ 导出导入。
7. 多宝宝 + 成长曲线。

## 15. 待用户提供的外部资源

- Supabase 免费项目（用户自建，约 2 分钟）。
- `SUPABASE_URL` 与 `SUPABASE_ANON_KEY` 两串密钥（贴入 `js/config.js`）。
- 登录方式确认：匿名登录 or 魔法邮件（默认匿名，最省事）。
