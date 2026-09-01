function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function unquote(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return JSON.parse(trimmed.startsWith("'") ? `"${trimmed.slice(1, -1)}"` : trimmed) as string
    } catch {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

export function tomlLiteral(value: string | boolean | number): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

export function getTopLevel(toml: string, key: string): string | null {
  const match = toml.match(new RegExp(`^${escapeRe(key)}\\s*=\\s*(.+)$`, 'm'))
  return match ? unquote(match[1]) : null
}

export function setTopLevel(
  toml: string,
  key: string,
  value: string | boolean | number | null
): string {
  const re = new RegExp(`^${escapeRe(key)}\\s*=\\s*.*$`, 'm')
  if (value === null) {
    if (!re.test(toml)) return toml
    return toml.replace(re, '').replace(/\n{3,}/g, '\n\n')
  }
  const line = `${key} = ${tomlLiteral(value)}`
  if (re.test(toml)) return toml.replace(re, line)
  const firstTable = toml.search(/^\[/m)
  if (firstTable <= 0) {
    const body = toml.trimEnd()
    return `${body}${body ? '\n' : ''}${line}\n`
  }
  const before = toml.slice(0, firstTable).trimEnd()
  return `${before}${before ? '\n' : ''}${line}\n\n${toml.slice(firstTable)}`
}

function tableHeaderRe(name: string): RegExp {
  return new RegExp(`^\\[${escapeRe(name)}\\]\\s*$`, 'm')
}

export function getTable(toml: string, name: string): string | null {
  const match = tableHeaderRe(name).exec(toml)
  if (!match || match.index === undefined) return null
  const start = match.index + match[0].length
  const rest = toml.slice(start)
  const next = rest.search(/^\s*\[/m)
  return (next === -1 ? rest : rest.slice(0, next)).replace(/^\r?\n/, '')
}

export function setTableKey(
  toml: string,
  table: string,
  key: string,
  value: string | boolean | number | null
): string {
  const match = tableHeaderRe(table).exec(toml)
  if (!match || match.index === undefined) {
    if (value === null) return toml
    const block = `\n[${table}]\n${key} = ${tomlLiteral(value)}\n`
    return `${toml.trimEnd()}\n${block}`
  }
  const headerEnd = match.index + match[0].length
  const rest = toml.slice(headerEnd)
  const next = rest.search(/^\s*\[/m)
  const bodyEnd = next === -1 ? toml.length : headerEnd + next
  const body = toml.slice(headerEnd, bodyEnd)
  const keyRe = new RegExp(`^${escapeRe(key)}\\s*=\\s*.*$`, 'm')
  let nextBody = body
  if (value === null) {
    nextBody = body.replace(keyRe, '')
  } else {
    const line = `${key} = ${tomlLiteral(value)}`
    nextBody = keyRe.test(body) ? body.replace(keyRe, line) : `${body.trimEnd()}\n${line}\n`
  }
  return toml.slice(0, headerEnd) + nextBody + toml.slice(bodyEnd)
}

export function removeTable(toml: string, name: string): string {
  const match = tableHeaderRe(name).exec(toml)
  if (!match || match.index === undefined) return toml
  const rest = toml.slice(match.index + match[0].length)
  const next = rest.search(/^\s*\[/m)
  const end = next === -1 ? toml.length : match.index + match[0].length + next
  return `${toml.slice(0, match.index).trimEnd()}\n${toml.slice(end)}`
}

export function setHttpHeaders(toml: string, table: string, headers: { key: string; value: string }[]): string {
  let next = setTableKey(toml, table, 'http_headers', null)
  next = removeTable(next, `${table}.http_headers`)
  if (headers.length === 0) return next
  let withTable = next
  if (!tableHeaderRe(`${table}.http_headers`).test(withTable)) {
    const parent = tableHeaderRe(table).exec(withTable)
    if (!parent || parent.index === undefined) {
      withTable = `${withTable.trimEnd()}\n\n[${table}]\n[${table}.http_headers]\n`
    } else {
      const headerEnd = parent.index + parent[0].length
      const rest = withTable.slice(headerEnd)
      const sibling = rest.search(/^\s*\[/m)
      const insertAt = sibling === -1 ? withTable.length : headerEnd + sibling
      withTable =
        `${withTable.slice(0, insertAt).trimEnd()}\n[${table}.http_headers]\n${withTable.slice(insertAt)}`
    }
  }
  for (const header of headers) {
    withTable = setTableKey(withTable, `${table}.http_headers`, header.key, header.value)
  }
  return withTable
}

export function getHttpHeaders(toml: string, table: string): { key: string; value: string }[] {
  const nested = getTable(toml, `${table}.http_headers`)
  if (nested) {
    const rows: { key: string; value: string }[] = []
    for (const line of nested.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(.+)$/)
      if (!match) continue
      rows.push({ key: unquote(match[1]), value: unquote(match[2]) })
    }
    return rows
  }
  const inline = getTableKey(toml, table, 'http_headers')
  if (!inline) return []
  const inner = inline.replace(/^\{/, '').replace(/\}$/, '')
  return inner.split(',').flatMap((part) => {
    const match = part.match(/^\s*([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(.+?)\s*$/)
    if (!match) return []
    return [{ key: unquote(match[1]), value: unquote(match[2]) }]
  })
}

export function getTableKey(toml: string, table: string, key: string): string | null {
  const body = getTable(toml, table)
  if (body === null) return null
  const match = body.match(new RegExp(`^${escapeRe(key)}\\s*=\\s*(.+)$`, 'm'))
  return match ? unquote(match[1]) : null
}

function patchTableBody(toml: string, table: string, patch: (body: string) => string | null): string {
  const match = tableHeaderRe(table).exec(toml)
  if (!match || match.index === undefined) {
    const body = patch('')
    if (body === null || !body.trim()) return toml
    return `${toml.trimEnd()}\n\n[${table}]\n${body.trim()}\n`
  }
  const headerEnd = match.index + match[0].length
  const rest = toml.slice(headerEnd)
  const next = rest.search(/^\s*\[/m)
  const bodyEnd = next === -1 ? toml.length : headerEnd + next
  const nextBody = patch(toml.slice(headerEnd, bodyEnd))
  if (nextBody === null) return toml
  return toml.slice(0, headerEnd) + nextBody + toml.slice(bodyEnd)
}

export function modelTableName(profile: string): string {
  return /^[A-Za-z0-9_-]+$/.test(profile) ? `model.${profile}` : `model.${JSON.stringify(profile)}`
}

export function listModelProfiles(toml: string): string[] {
  const profiles: string[] = []
  const re = /^\[model\.("(?:\\.|[^"])+"|[A-Za-z0-9_-]+)\]\s*$/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(toml))) {
    const raw = match[1]
    const name = raw.startsWith('"') ? unquote(raw) : raw
    if (name && !profiles.includes(name)) profiles.push(name)
  }
  return profiles
}

export function getTableArray(toml: string, table: string, key: string): string[] {
  const body = getTable(toml, table)
  if (body === null) return []
  const match = body.match(new RegExp(`^${escapeRe(key)}\\s*=\\s*(\\[[\\s\\S]*?\\])`, 'm'))
  if (!match) return []
  try {
    const parsed: unknown = JSON.parse(match[1].replace(/,(\s*\])/g, '$1'))
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function setTableArray(
  toml: string,
  table: string,
  key: string,
  values: string[] | null
): string {
  return patchTableBody(toml, table, (body) => {
    const keyRe = new RegExp(`^${escapeRe(key)}\\s*=\\s*(?:\\[[\\s\\S]*?\\]|.*)$`, 'm')
    if (!values || values.length === 0) return body.replace(keyRe, '')
    const line = `${key} = [${values.map((item) => tomlLiteral(item)).join(', ')}]`
    return keyRe.test(body) ? body.replace(keyRe, line) : `${body.trimEnd()}\n${line}\n`
  })
}

export function getInlineTable(
  toml: string,
  table: string,
  key: string
): { key: string; value: string }[] {
  const nested = getTable(toml, `${table}.${key}`)
  if (nested) {
    const rows: { key: string; value: string }[] = []
    for (const line of nested.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(.+)$/)
      if (!match) continue
      rows.push({ key: unquote(match[1]), value: unquote(match[2]) })
    }
    return rows
  }
  const inline = getTableKey(toml, table, key)
  if (!inline) return []
  const inner = inline.replace(/^\{/, '').replace(/\}$/, '')
  return inner.split(',').flatMap((part) => {
    const match = part.match(/^\s*([A-Za-z0-9_-]+|"[^"]+")\s*=\s*(.+?)\s*$/)
    if (!match) return []
    return [{ key: unquote(match[1]), value: unquote(match[2]) }]
  })
}

export function setInlineTable(
  toml: string,
  table: string,
  key: string,
  entries: { key: string; value: string }[]
): string {
  let next = setTableKey(toml, table, key, null)
  next = removeTable(next, `${table}.${key}`)
  const pairs = entries.filter((entry) => entry.key.trim())
  if (pairs.length === 0) return next
  const literal = `{ ${pairs
    .map((entry) => `${tomlLiteral(entry.key.trim())} = ${tomlLiteral(entry.value)}`)
    .join(', ')} }`
  return patchTableBody(next, table, (body) => {
    const keyRe = new RegExp(`^${escapeRe(key)}\\s*=\\s*.*$`, 'm')
    const line = `${key} = ${literal}`
    return keyRe.test(body) ? body.replace(keyRe, line) : `${body.trimEnd()}\n${line}\n`
  })
}
