// 문제 URL에서 플랫폼과 표시용 이름을 추론 (네트워크 없이 URL 패턴만 사용)
function parseProblemUrl(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  const path = u.pathname
  let m
  if (host.endsWith('codeforces.com')) {
    m = path.match(/\/problemset\/problem\/(\d+)\/(\w+)/) || path.match(/\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/)
    return { platform: 'Codeforces', name: m ? `CF ${m[1]}${m[2].toUpperCase()}` : '' }
  }
  if (host.endsWith('atcoder.jp')) {
    m = path.match(/\/contests\/[^/]+\/tasks\/(\w+)/)
    return { platform: 'AtCoder', name: m ? m[1].split('_').join(' ').toUpperCase() : '' }
  }
  if (host.endsWith('acmicpc.net')) {
    m = path.match(/\/problem\/(\d+)/)
    return { platform: 'BOJ', name: m ? `BOJ ${m[1]}` : '' }
  }
  if (host.endsWith('usaco.org')) {
    const cpid = u.searchParams.get('cpid')
    return { platform: 'USACO', name: cpid ? `USACO ${cpid}` : '' }
  }
  return { platform: 'Other', name: '' }
}

// 문제 URL → 저지 AC 매칭 키 ("cf:1850A" | "ac:abc300_a"). 매칭 불가 URL은 null.
// solved.ac(BOJ)와 kenkoooo problems.json은 브라우저 CORS 차단이라 대상에서 제외 (실측 확인).
function judgeKeyFromUrl(url) {
  if (!url) return null
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host.endsWith('codeforces.com')) {
    const m = u.pathname.match(/\/problemset\/problem\/(\d+)\/(\w+)/) || u.pathname.match(/\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/)
    return m ? `cf:${m[1]}${m[2].toUpperCase()}` : null
  }
  if (host.endsWith('atcoder.jp')) {
    const m = u.pathname.match(/\/contests\/[^/]+\/tasks\/(\w+)/)
    return m ? `ac:${m[1].toLowerCase()}` : null
  }
  return null
}

// 인박스 한 줄 → 문제 필드. "이름 URL" 혼합, URL 단독, 텍스트 단독 모두 허용
function parseProblemLine(line) {
  const trimmed = line.trim().replace(/^[-*•]\s*/, '')
  if (!trimmed) return null
  const url = trimmed.match(/https?:\/\/\S+/)?.[0] || ''
  const parsed = url ? parseProblemUrl(url) : null
  const name = trimmed.replace(url, '').trim() || parsed?.name || (url ? url.replace(/^https?:\/\//, '').slice(0, 60) : '')
  if (!name) return null
  return { name, url, platform: parsed?.platform || 'Other' }
}

export { parseProblemUrl, judgeKeyFromUrl, parseProblemLine }
