/** Minimal, dependency-free tokenizer for the code viewer. */
type Kind = 'comment' | 'string' | 'keyword' | 'annotation' | 'number' | 'type' | 'plain'

export type Token = { text: string; kind: Kind }

const KEYWORDS = new Set([
  'fun', 'val', 'var', 'class', 'object', 'interface', 'data', 'sealed', 'enum', 'suspend', 'when',
  'if', 'else', 'return', 'import', 'package', 'private', 'internal', 'public', 'protected', 'override',
  'async', 'await', 'const', 'let', 'function', 'export', 'import', 'new', 'type', 'as', 'is', 'null',
  'true', 'false', 'this', 'super', 'throw', 'try', 'catch', 'finally', 'for', 'while', 'in', 'by', 'init',
  'companion', 'abstract', 'open', 'inline', 'reified', 'crossinline', 'lateinit', 'within', 'assert',
])

const RE = new RegExp(
  [
    /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.source,
    /(?<string>"""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/.source,
    /(?<annotation>@[A-Za-z_][\w.]*)/.source,
    /(?<number>\b\d+(?:\.\d+)?[fFdDlL]?\b)/.source,
    /(?<word>[A-Za-z_][\w]*)/.source,
  ].join('|'),
  'g',
)

export function tokenizeLine(line: string): Token[] {
  const out: Token[] = []
  let last = 0
  for (const m of line.matchAll(RE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ text: line.slice(last, idx), kind: 'plain' })
    const g = m.groups ?? {}
    const text = m[0]
    let kind: Kind = 'plain'
    if (g.comment) kind = 'comment'
    else if (g.string) kind = 'string'
    else if (g.annotation) kind = 'annotation'
    else if (g.number) kind = 'number'
    else if (KEYWORDS.has(text)) kind = 'keyword'
    else if (/^[A-Z][A-Za-z0-9_]*$/.test(text)) kind = 'type'
    out.push({ text, kind })
    last = idx + text.length
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: 'plain' })
  return out
}

export const TOKEN_CLASS: Record<Kind, string> = {
  plain: '',
  comment: 'text-[color:var(--faint)] italic',
  string: 'text-[color:var(--ok)]',
  keyword: 'text-[color:var(--accent)]',
  annotation: 'text-[color:var(--warn)]',
  number: 'text-[color:var(--info)]',
  type: 'text-[color:var(--fg)]',
}
