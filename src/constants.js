import { CheckCircle2, XCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEYS = {
  PROBLEMS: 'cplog_problems',
  NOTES: 'cplog_notes',
  FOLDERS: 'cplog_folders',
  SNIPPETS: 'cplog_snippets',
  GITHUB: 'cplog_github_settings',
  UI: 'cplog_ui_state',
  THEME: 'cplog_theme',
  SYNC: 'cplog_sync_state',
}

const PLATFORMS = ['Codeforces', 'AtCoder', 'BOJ', 'USACO', 'JUNGOL', 'Other']

const PLATFORM_BADGE = {
  Codeforces: 'bg-tier-blue/10 text-tier-blue',
  AtCoder: 'bg-tier-cyan/10 text-tier-cyan',
  BOJ: 'bg-tier-purple/10 text-tier-purple',
  USACO: 'bg-tier-green/10 text-tier-green',
  JUNGOL: 'bg-tier-orange/10 text-tier-orange',
  Other: 'bg-surface-alt text-ink-muted',
}

const DIFFICULTY_TIER_BADGE = {
  gray: 'bg-tier-gray/10 text-tier-gray',
  green: 'bg-tier-green/10 text-tier-green',
  cyan: 'bg-tier-cyan/10 text-tier-cyan',
  blue: 'bg-tier-blue/10 text-tier-blue',
  purple: 'bg-tier-purple/10 text-tier-purple',
  orange: 'bg-tier-orange/10 text-tier-orange',
  red: 'bg-tier-red/10 text-tier-red',
}

// 상태는 To Do / Done 2가지만 (In Progress는 2026-07-13 제거 — 사용자 요청)
const COLUMNS = [
  { key: 'todo', label: 'To Do', hint: '풀어야 할 문제' },
  { key: 'done', label: 'Done', hint: '해결 완료 · 노트 작성' },
]

// 리스트 뷰 정렬 순서 — 미해결이 위, 끝난 문제가 맨 아래
const STATUS_ORDER = { todo: 0, done: 1 }

const TAG_SUGGESTIONS = ['DP', 'Greedy', 'Graph', 'Binary Search', 'Number Theory', 'BFS/DFS', 'Data Structures', 'Strings', 'Implementation', 'Math', 'Geometry', 'Combinatorics', 'Brute Force', 'Divide and Conquer', 'Backtracking', 'Bitmasking', 'Segment Tree', 'Fenwick Tree', 'Heap/Priority Queue', 'Hashing', 'Two Pointers', 'Sliding Window', 'Queue/Deque', 'Stack', 'Trie', 'SCC/Topological Sort', 'Dijkstra/A*', 'Bellman-Ford/Floyd-Warshall', 'SPFA', 'Floyd Cycle Detection', 'Union-Find/Disjoint Set Union (DSU)', 'Kruskal/Prim (MST)', 'Eulerian Path/Circuit', 'Hamiltonian Path/Circuit', 'Convex Hull', 'Line Sweep', 'Segment Intersection', 'Closest Pair of Points', 'Voronoi Diagram', 'Delaunay Triangulation', 'Dynamic Convex Hull', 'Persistent Data Structures', 'Heavy-Light Decomposition', 'Centroid Decomposition', 'Mo’s Algorithm', 'Sqrt Decomposition', 'Randomized Algorithms', 'Monte Carlo Method', 'Las Vegas Algorithm', 'Approximation Algorithms', 'Online Algorithms']

// 폴더 색상 프리셋 — 다크/라이트 양쪽에서 읽히는 500 계열 고정 hue
const FOLDER_COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  pink: '#ec4899',
}
const FOLDER_EMOJI_PRESETS = ['📁', '🏆', '📚', '🔥', '💡', '🎯', '⚡', '📝']

const DAY_MS = 86400000

const REVIEW_OPTIONS = [
  { key: '3d', label: '3일 뒤', days: 3 },
  { key: '1w', label: '1주 뒤', days: 7 },
  { key: '1m', label: '1달 뒤', days: 30 },
  { key: 'none', label: '안 함', days: null },
]

const DEFAULT_GITHUB_SETTINGS = {
  username: '',
  repo: '',
  branch: 'main',
  pat: '',
  dataRepo: 'cplog-data',
  dataBranch: 'main',
  autoSync: true,
  cfHandle: '',
  atcoderHandle: '',
}

const TOAST_STYLE = {
  success: { icon: CheckCircle2, cls: 'border-success/30 bg-success-soft text-success' },
  error: { icon: XCircle, cls: 'border-danger/30 bg-danger-soft text-danger' },
}

export { LS_KEYS, PLATFORMS, PLATFORM_BADGE, DIFFICULTY_TIER_BADGE, COLUMNS, STATUS_ORDER, TAG_SUGGESTIONS, FOLDER_COLORS, FOLDER_EMOJI_PRESETS, DAY_MS, REVIEW_OPTIONS, DEFAULT_GITHUB_SETTINGS, TOAST_STYLE }
