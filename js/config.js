/**
 * Supabase 配置
 * 未配置时应用保持本地模式（IndexedDB），不影响记录功能。
 */
var SUPABASE_CONFIG = {
  url: 'https://aqyvyouyvyazuumwvryl.supabase.co',
  anonKey: 'sb_publishable_8jRuUMETfmZvHcFDTYo88A_7Om4aURH'
};

// 记录类型定义
var EVENT_TYPES = {
  diaper:      { label: '换尿布',     icon: '🧷', bg: 'var(--c-diaper)',  color: 'var(--c-diaper-t)' },
  formula:     { label: '奶粉',       icon: '🍼', bg: 'var(--c-formula)', color: 'var(--c-formula-t)' },
  milk_bottle: { label: '母乳瓶喂',   icon: '🫙', bg: 'var(--c-bottle)',  color: 'var(--c-bottle-t)' },
  milk_direct: { label: '母乳亲喂',   icon: '🤱', bg: 'var(--c-direct)',  color: 'var(--c-direct-t)' },
  sleep:       { label: '睡眠',       icon: '😴', bg: 'var(--c-sleep)',   color: 'var(--c-sleep-t)' },
  pump:        { label: '吸奶',       icon: '⏺', bg: 'var(--c-pump)',    color: 'var(--c-pump-t)' },
  weight:      { label: '身高体重',   icon: '⚖️', bg: 'var(--c-health)',  color: 'var(--c-health-t)' }
};

// 默认首页按钮顺序
var DEFAULT_HOME_BUTTONS = ['diaper', 'formula', 'milk_bottle', 'milk_direct', 'sleep', 'pump'];

// 喂养类型（用于倒计时判断）
var FEED_TYPES = ['formula', 'milk_bottle', 'milk_direct'];

// 计时类型
var TIMER_TYPES = ['pump', 'sleep', 'milk_direct'];
