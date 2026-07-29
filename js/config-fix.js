EVENT_TYPES = {
  diaper: { label: '换尿布', icon: '🧷', bg: 'var(--c-diaper)', color: 'var(--c-diaper-t)' },
  formula: { label: '奶粉', icon: '🍼', bg: 'var(--c-formula)', color: 'var(--c-formula-t)' },
  milk_bottle: { label: '母乳瓶喂', icon: '🍼', bg: 'var(--c-bottle)', color: 'var(--c-bottle-t)' },
  milk_direct: { label: '母乳亲喂', icon: '🤱', bg: 'var(--c-direct)', color: 'var(--c-direct-t)' },
  sleep: { label: '睡眠', icon: '😴', bg: 'var(--c-sleep)', color: 'var(--c-sleep-t)' },
  pump: { label: '吸奶', icon: '⏺', bg: 'var(--c-pump)', color: 'var(--c-pump-t)' },
  weight: { label: '身高体重', icon: '⚖️', bg: 'var(--c-health)', color: 'var(--c-health-t)' }
};

DEFAULT_HOME_BUTTONS = ['diaper', 'formula', 'milk_bottle', 'milk_direct', 'sleep', 'pump'];
FEED_TYPES = ['formula', 'milk_bottle', 'milk_direct'];
TIMER_TYPES = ['pump', 'sleep', 'milk_direct'];
