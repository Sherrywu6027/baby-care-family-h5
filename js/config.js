/**
 * Supabase 配置 —— Phase 0 完成后填入
 * 未填时应用以纯本地模式运行（IndexedDB），不影响记录功能。
 * 云端同步需要你完成 Phase 0：
 *   1. supabase.com 建免费项目
 *   2. SQL Editor 跑 supabase/schema.sql
 *   3. Authentication → 开启 Anonymous Sign-ins
 *   4. Project Settings → API → 复制 URL 和 anon key 填到下面
 *   5. 若 Data API 访问受限，按官方文档给 anon/authenticated 角色开放表与函数访问权限
 */
var SUPABASE_CONFIG = {
  url: 'https://aqyvyouyvyazuumwvryl.supabase.co',        // 例: 'https://xxxxx.supabase.co'
  anonKey: 'sb_publishable_8jRuUMETfmZvHcFDTYo88A_7Om4aURH'     // 例: 'eyJhbGciOiJIUzI1NiIsInR5c...'
};

// 类型定义
var EVENT_TYPES = {
  diaper:       { label: '换尿片', icon: '💧', bg: 'var(--c-diaper)',  color: 'var(--c-diaper-t)' },
  formula:      { label: '奶粉',   icon: '🍼', bg: 'var(--c-formula)', color: 'var(--c-formula-t)' },
  milk_bottle:  { label: '母乳瓶喂', icon: '🥛', bg: 'var(--c-bottle)',  color: 'var(--c-bottle-t)' },
  milk_direct:  { label: '母乳亲喂', icon: '😋', bg: 'var(--c-direct)',  color: 'var(--c-direct-t)' },
  sleep:        { label: '睡眠',   icon: '😴', bg: 'var(--c-sleep)',   color: 'var(--c-sleep-t)' },
  pump:         { label: '吸奶',   icon: '⏱', bg: 'var(--c-pump)',    color: 'var(--c-pump-t)' },
  weight:       { label: '身高体重', icon: '⚖️', bg: 'var(--c-health)',  color: 'var(--c-health-t)' }
};

// 默认首页按钮顺序
var DEFAULT_HOME_BUTTONS = ['diaper', 'formula', 'milk_bottle', 'milk_direct', 'sleep', 'pump'];

// 喂奶类型（用于倒计时判断）
var FEED_TYPES = ['formula', 'milk_bottle', 'milk_direct'];

// 计时类型
var TIMER_TYPES = ['pump', 'sleep', 'milk_direct'];
