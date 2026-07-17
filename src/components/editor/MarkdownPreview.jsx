import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '../../lib/utils'
import { isAssetPath } from '../../lib/assets'

// [[제목]] 위키링크를 링크 노드(#wiki:제목)로 바꾸는 remark 플러그인.
// code/inlineCode는 children 없이 value만 가지므로 재귀에서 자연히 제외된다.
const WIKILINK_RE = /\[\[([^\][\n]+?)\]\]/g

function remarkWikiLinks() {
  const transform = (node) => {
    if (!Array.isArray(node.children)) return
    const next = []
    for (const child of node.children) {
      if (child.type !== 'text') {
        transform(child)
        next.push(child)
        continue
      }
      const value = child.value
      let last = 0
      let m
      WIKILINK_RE.lastIndex = 0
      while ((m = WIKILINK_RE.exec(value))) {
        if (m.index > last) next.push({ type: 'text', value: value.slice(last, m.index) })
        next.push({ type: 'link', url: `#wiki:${encodeURIComponent(m[1])}`, children: [{ type: 'text', value: m[1] }] })
        last = m.index + m[0].length
      }
      if (last === 0) next.push(child)
      else if (last < value.length) next.push({ type: 'text', value: value.slice(last) })
    }
    node.children = next
  }
  return transform
}

// assets/ 경로 이미지를 로컬 캐시(→IndexedDB→데이터 리포 API) 순으로 비동기 해석해 표시.
// data:/http(s) 등 그 외 src는 그대로. (구버전 base64 노트 호환)
function AssetImage({ src, alt, resolveAsset }) {
  const [state, setState] = useState(() => (isAssetPath(src || '') ? { status: 'loading', url: null } : { status: 'ok', url: src }))
  useEffect(() => {
    if (!isAssetPath(src || '')) {
      setState({ status: 'ok', url: src })
      return
    }
    let alive = true
    setState({ status: 'loading', url: null })
    Promise.resolve(resolveAsset?.(src)).then((u) => {
      if (alive) setState(u ? { status: 'ok', url: u } : { status: 'missing', url: null })
    })
    return () => {
      alive = false
    }
  }, [src, resolveAsset])

  if (state.status === 'loading')
    return <span className="inline-block rounded bg-surface-alt px-2 py-1 text-[11px] text-ink-faint">이미지 불러오는 중…</span>
  if (state.status === 'missing')
    return <span className="inline-block rounded bg-surface-alt px-2 py-1 text-[11px] text-ink-faint">🖼️ 이미지를 찾을 수 없습니다 (동기화 필요)</span>
  return <img src={state.url} alt={alt || ''} />
}

function MarkdownPreview({ content, notes, onOpenWikiLink, resolveAsset }) {
  const noteTitles = useMemo(() => new Set(notes.map((n) => (n.title || '').trim()).filter(Boolean)), [notes])
  return (
    <div className="h-full overflow-y-auto bg-surface p-5">
      <div className="cp-prose mx-auto max-w-2xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkWikiLinks]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          // 기본 urlTransform은 data:·상대경로를 필터링 — 이미지 data URI(구버전)와 assets/ 상대경로를 통과시킴
          urlTransform={(url) => (url.startsWith('data:image/') || isAssetPath(url) ? url : defaultUrlTransform(url))}
          components={{
            // eslint-disable-next-line no-unused-vars
            img({ src, alt, node, ...props }) {
              return <AssetImage src={src} alt={alt} resolveAsset={resolveAsset} {...props} />
            },
            // eslint-disable-next-line no-unused-vars
            a({ href, children, node, ...props }) {
              if (href?.startsWith('#wiki:')) {
                const title = decodeURIComponent(href.slice('#wiki:'.length))
                const exists = noteTitles.has(title.trim())
                return (
                  <a
                    href={href}
                    className={cn('cp-wikilink', !exists && 'cp-wikilink-missing')}
                    title={exists ? `"${title}" 노트 열기` : `"${title}" 노트 만들기`}
                    onClick={(e) => {
                      e.preventDefault()
                      onOpenWikiLink(title)
                    }}
                  >
                    {children}
                  </a>
                )
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              )
            },
          }}
        >
          {content || '_미리보기가 여기에 표시됩니다._'}
        </ReactMarkdown>
      </div>
    </div>
  )
}

export { MarkdownPreview }
