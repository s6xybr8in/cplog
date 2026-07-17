// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(ts) {
  const d = new Date(ts)
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function slugify(title) {
  const cleaned = (title || 'untitled')
    .trim()
    .replace(/[\\/:*?"<>|#%]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
  return cleaned.slice(0, 80) || 'untitled'
}

function getDifficultyTier(value) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return 'gray'
  if (n < 1200) return 'gray'
  if (n < 1400) return 'green'
  if (n < 1600) return 'cyan'
  if (n < 1900) return 'blue'
  if (n < 2100) return 'purple'
  if (n < 2400) return 'orange'
  return 'red'
}

export { cn, uid, formatDate, formatDateTime, slugify, getDifficultyTier }
