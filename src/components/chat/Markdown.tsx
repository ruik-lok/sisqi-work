import { Fragment, type ReactNode } from 'react'

/**
 * 极简 Markdown 渲染：覆盖模型实际会输出的语法——代码块、标题、列表、引用、**粗体**、`行内代码`、链接。
 * 不引第三方库、不用 dangerouslySetInnerHTML；流式输出时每帧重解析，成本可控。
 */

type Block =
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' }
  | { kind: 'p'; text: string }

const FENCE = /^```(w*)s*$/

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(FENCE)
    if (fence) {
      const lang = fence[1]
      const buf: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i += 1
      }
      i += 1 // 跳过结束围栏
      blocks.push({ kind: 'code', lang, text: buf.join('\n') })
      continue
    }
    if (!line.trim()) {
      i += 1
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] })
      i += 1
      continue
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
      i += 1
      continue
    }
    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      const buf: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^>\s?(.*)$/)
        if (!m) break
        buf.push(m[1])
        i += 1
      }
      blocks.push({ kind: 'quote', text: buf.join('\n') })
      continue
    }
    const bullet = line.match(/^\s*([-*+])\s+(.*)$/)
    if (bullet) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+])\s+(.*)$/)
        if (!m) break
        items.push(m[2])
        i += 1
      }
      blocks.push({ kind: 'list', ordered: false, items })
      continue
    }
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (ordered) {
      const items: string[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(\d+)[.)]\s+(.*)$/)
        if (!m) break
        items.push(m[2])
        i += 1
      }
      blocks.push({ kind: 'list', ordered: true, items })
      continue
    }
    // 普通段落：连续行合并
    const buf: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !/^\s*([-*+]|\d+[.)]|#{1,4}\s|>|```)/.test(lines[i])) {
      buf.push(lines[i])
      i += 1
    }
    blocks.push({ kind: 'p', text: buf.join('\n') })
  }
  return blocks
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g

/** 行内语法：粗体 / 行内代码 / 链接（链接只做样式，不跳转，避免把 WebView 导航走） */
export function inlineNodes(text: string, prefix = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE.lastIndex = 0
  let n = 0
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const token = m[0]
    const key = `${prefix}-${n++}`
    if (token.startsWith('**')) {
      out.push(
        <strong key={key} className="font-semibold text-[var(--fg)]">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded-[6px] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--fg)]">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      const label = token.slice(1, token.indexOf(']'))
      out.push(
        <span key={key} className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2">
          {label}
        </span>,
      )
    }
    last = m.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.map((node, idx) => (typeof node === 'string' ? <Fragment key={`${prefix}-t${idx}`}>{node}</Fragment> : node))
}

export function MarkdownText({ text }: { text: string }) {
  const blocks = parseMarkdown(text)
  return (
    <div className="space-y-2.5">
      {blocks.map((b, idx) => {
        const key = `b${idx}`
        if (b.kind === 'code') {
          return (
            <pre key={key} className="wrap-any overflow-x-auto rounded-[14px] bg-[var(--surface-2)] p-3 font-mono text-[12.5px] leading-[1.7] text-[var(--fg)]">
              <code>{b.text}</code>
            </pre>
          )
        }
        if (b.kind === 'heading') {
          const size = b.level <= 2 ? 'text-[17px]' : 'text-[15px]'
          return (
            <p key={key} className={`${size} font-semibold text-[var(--fg)]`}>
              {inlineNodes(b.text, key)}
            </p>
          )
        }
        if (b.kind === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul'
          return (
            <Tag key={key} className={b.ordered ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}>
              {b.items.map((item, j) => (
                <li key={j} className="pl-0.5 leading-[1.7]">
                  {inlineNodes(item, `${key}-${j}`)}
                </li>
              ))}
            </Tag>
          )
        }
        if (b.kind === 'quote') {
          return (
            <blockquote key={key} className="border-l-2 border-[var(--line-strong)] pl-3 text-[var(--muted)]">
              {b.text.split('\n').map((line, j) => (
                <p key={j}>{inlineNodes(line, `${key}-${j}`)}</p>
              ))}
            </blockquote>
          )
        }
        if (b.kind === 'hr') {
          return <hr key={key} className="border-[var(--line)]" />
        }
        return (
          <p key={key} className="whitespace-pre-wrap leading-[1.75]">
            {inlineNodes(b.text, key)}
          </p>
        )
      })}
    </div>
  )
}
