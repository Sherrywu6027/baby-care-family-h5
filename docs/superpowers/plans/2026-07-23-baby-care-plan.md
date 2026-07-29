# 宝宝照顾记录应用 · 实现计划（MVP）

- 日期：2026-07-23
- 来源 spec：`docs/superpowers/specs/2026-07-23-baby-care-design.md`
- 目标：把 spec 拆成可逐步执行的开发任务，每阶段可独立验证。

---

## 前置：用户需完成的云端准备（Phase 0，约 5 分钟）

1. 打开 https://supabase.com → 注册/登录 → New Project（免费档）。
2. 项目建好后，进 **SQL Editor** 执行附录 A 的 `schema.sql`（建表 + RLS）。
3. 进 **Authentication → Providers**，开启 **Anonymous Sign-ins**（默认匿名登录）。
4. 进 **Project Settings → API**，复制：
   - `Project URL`
   - `anon public key`
5. 把这两串填进 `js/config.js`（见附录 B）。
6. 可选：若要魔法邮件登录，在 Auth → URL Configuration 填本站回调。

> 这步需要你的账号操作（要邮箱+验证码），我无法代劳；填好 `config.js` 后开发即可联调。

---

## Phase 1 — 项目骨架（PWA 壳 + 路由）

**产出文件**
- `index.html`：PWA 入口，引入 `manifest.webmanifest`、`sw.js`、Supabase CDN JS、`js/app.js`。
- `manifest.webmanifest`：name、icons（用 emoji 转 svg/现成 192/512 图标）、`display: standalone`、主题色 `#6366f1`。
- `sw.js`：缓存 `index.html` 与静态资源，离线可开。
- `css/styles.css`：设计 token（CSS 变量：主色、各类型底色、倒计时渐变），移动端单列布局。
- `js/app.js`：极简 hash 路由（`#/today`、`#/log`、`#/stats`、`#/settings`），启动初始化。
- `js/config.js`：Supabase URL + anon key（用户填）。

**验收**：手机浏览器打开 `index.html` → 可加到主屏；断网后仍可打开（离线壳）；四个路由切换正常。

---

## Phase 2 — 本地数据层（IndexedDB）

**产出文件**：`js/db.js`
- 封装 `openDB()`（库名 `babycare`，版本 1）。
- 对象仓库：`events`、`babies`、`meta`（含当前 family_id、当前 baby_id、`homeButtons` 顺序）。
- API：`addEvent`、`updateEvent`、`deleteEvent`、`getEventsByDay`、`getAllBabies`、`upsertBaby`、`getMeta`/`setMeta`。
- 每条 `events` 落库时带 `sync_status='local'`、`updated_at=now()`。
- 写入后立即返回，UI 同步刷新（离线可用）。

**验收**：不联 Supabase 也能新增/查询/删除记录；刷新页面数据还在（IndexedDB 持久化）。

---

## Phase 3 — 同步层（Supabase 增量同步）

**产出文件**：`js/sync.js`
- `initSupabase()`：用 `config.js` 初始化客户端。
- 登录：默认匿名 `signInAnonymously()`；首次写库前确保已登录，拿到 `auth.uid()` → 经 `members` 表映射 `family_id`。
- 家庭码：
  - 无 `family_id` → 创建 `families` 生成 6 位 `code`，写 `meta`。
  - 有 `code` 输入 → 查 `families` → 加入（写 `members`）。
- 增量同步：联网时按 `updated_at` 拉取云端较新记录 + 推送本地 `sync_status='local'` 记录；成功置 `synced`。
- 冲突：`upsert` 按 `id`，last-write-wins。

**验收**：两台设备用同一家庭码 → 一端新增记录，另一端联网后能看到；断网新增不丢，恢复后同步。

---

## Phase 4 — 首页（今日页）

**产出文件**：`js/calc.js`、`js/ui-today.js`、`js/timer.js`（计时器基础）
- 顶部：日期 + 宝宝切换（读 `babies` / `meta.currentBabyId`）。
- **倒计时卡**：`js/calc.js` 的 `timeSinceLastFeed(babyId)` → 取最近喂奶类 `start_time`，每秒刷新；靛蓝渐变。
- **今日汇总**：`calcToday(babyId)` → 喝奶总 ml/次数、睡眠总时长、尿片数。
- **进行中计时芯片**：订阅 `timer.js` 的活跃计时（吸奶/睡眠）。
- **可自定义快捷按钮**：
  - 默认 6 类；读 `meta.homeButtons` 顺序渲染。
  - 点按钮 → 弹出记录表单（默认 `start_time=now()`，可改时间；按 `type` 显隐字段：ml / duration / stool / note）。
  - 「设置→首页按钮」入口在 Phase 7 实现增删。

**验收**：点「奶粉」→ 填 130ml → 首页出现记录、汇总+1 次/+130ml、倒计时重置；按钮增减在设置里生效。

---

## Phase 5 — 计时能力

**产出文件**：`js/timer.js`（完善）、`ui-today` 接入
- 吸奶：点「吸奶」→ `timer.start('pump')` 走表（显示在芯片）；可填目标容量；点结束 → `addEvent({type:'pump', start, end, amount_ml})`。
- 母乳亲喂：起止计时或手动填 `duration_min`。
- 睡眠：记起止时间 → `calcSleep` 算时长；或「开始睡/醒来」计时模式。

**验收**：吸奶计时 12:34 后点结束 → 生成一条 pump 记录含时长；睡眠两段同日 → 汇总睡眠时长累加。

---

## Phase 6 — 记录页 & 统计页

**产出文件**：`js/ui-log.js`、`js/ui-stats.js`
- 记录页：时间线倒序，按 `type` 筛选；点条目可编辑/删除（删除同步置本地删除标记并推云端）。
- 统计页：日/周/月切换 → 喝奶量曲线、睡眠总时长、喂养次数、尿片数；**成长记录**（身高/体重）单独曲线（数据类型复用 `events` 的 `health`+`note` 或独立字段，MVP 用 `note` 存数值+单位）。

**验收**：新增 10 条混合记录 → 记录页正确列出并可筛选；统计页曲线随筛选区间更新。

---

## Phase 7 — 设置页（宝宝/按钮/家庭码/导出导入）

**产出文件**：`js/ui-settings.js`
- 宝宝管理：增/改/删 `babies`（小名、生日、头像 emoji、排序）。
- **首页按钮自定义**：勾选显示哪些类型（默认 6 + 备选项如 `health`），顺序保存 `meta.homeButtons`。
- 家庭码：显示本机 `code` / 输入他人 `code` 加入。
- 导出：全部记录 + `babies` + `meta` → 下载 `babycare-backup-YYYYMMDD.json`。
- 导入：读 JSON → 按 `id` upsert 合并。

**验收**：新增宝宝「老二」→ 首页可切换且各自独立记录；勾掉「母乳亲喂」→ 首页按钮消失；导出 JSON 再导入不重复。

---

## 附录 A：`supabase/schema.sql`

```sql
-- 家庭组
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz default now()
);

-- 成员（匿名/魔法邮件）
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  auth_user uuid,
  role text default 'parent'
);

-- 宝宝档案
create table if not exists babies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  name text,
  birthday date,
  avatar text,
  sort int default 0
);

-- 核心记录
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade,
  baby_id uuid references babies(id) on delete cascade,
  type text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  amount_ml int,
  duration_min int,
  stool boolean default false,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  sync_status text default 'local'
);

create index if not exists idx_events_family on events(family_id);
create index if not exists idx_events_baby on events(baby_id);
create index if not exists idx_events_start on events(start_time);

-- 行级权限：仅同家庭成员可读写
alter table families enable row level security;
alter table members enable row level security;
alter table babies enable row level security;
alter table events enable row level security;

-- 解析当前用户所属 family_id
create or replace function current_family()
returns uuid language sql stable as $$
  select family_id from members where auth_user = auth.uid() limit 1
$$;

create policy "family read" on families for select using (id = current_family());
create policy "family insert" on families for insert with check (true);
create policy "member read" on members for select using (family_id = current_family());
create policy "member upsert" on members for insert with check (true);
create policy "member update" on members for update using (family_id = current_family());
create policy "baby rw" on babies for all using (family_id = current_family()) with check (family_id = current_family());
create policy "event rw" on events for all using (family_id = current_family()) with check (family_id = current_family());
```

## 附录 B：`js/config.js` 模板

```js
// 用户填写：Supabase 项目 API 页的两串
export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
```

---

## 全局验收标准

- [ ] 手机网页可加到主屏、离线能开、离线能记。
- [ ] 六类默认记录可秒记，按钮可自定义增删（含体温/健康备选项）。
- [ ] 距上次喝奶倒计时实时刷新；今日汇总准确。
- [ ] 吸奶/亲喂/睡眠计时正确生成带时长的记录。
- [ ] 家庭码让两台设备共享同一份记录，断网不丢、恢复同步。
- [ ] 导出/导入 JSON 不丢不重。
- [ ] 多宝宝各自独立、可切换。

## 建议开发顺序

Phase 0（你做）→ 1 → 2 → 3（先打通同步）→ 4 → 5 → 6 → 7。
每阶段结束即可在手机上实测，不必等全部做完。
