
// 格式化日期时间 (完整格式)
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// 简化日期显示：今天、昨天或具体日期 (月/日)
export const formatRelativeDate = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const itemDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (itemDateOnly.getTime() === today.getTime()) {
    return '今天';
  } else if (itemDateOnly.getTime() === yesterday.getTime()) {
    return '昨天';
  } else {
    return new Intl.DateTimeFormat('zh-TW', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
};

// 格式化时间（只显示 时:分）
export const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false // 使用 24 小时制可能更清晰
  }).format(date);
};

// --- 可选：组合相对日期和时间 ---
// 如果需要经常组合使用，可以提供一个组合函数
export const formatRelativeDateTime = (date: Date): string => {
  return `${formatRelativeDate(date)} ${formatTime(date)}`;
};

// --- 可选：更详细的相对时间，例如 "几分钟前" ---
// 如果需要更友好的相对时间，可以引入像 date-fns 这样的库
// 或者实现一个更复杂的逻辑
// import { formatDistanceToNow } from 'date-fns';
// import { zhTW } from 'date-fns/locale';
// export const formatDistance = (date: Date): string => {
//   return formatDistanceToNow(date, { addSuffix: true, locale: zhTW });
// }; 