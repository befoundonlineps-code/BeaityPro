// Reading a .sql file well enough to answer two questions about it, and no
// further. This is not a SQL parser and must not grow into one — it exists
// because two guards need the same reading, and two copies of a scanner is how
// the first one shipped with a bug in it.

// Dollar-quoted function bodies are not either guard's business: the statements
// inside them are planned by PL/pgSQL when the function runs, not by the editor
// when the script does.
//
// ⚠️ ONE SCANNER FOR STRINGS AND COMMENTS, NOT TWO PASSES. Stripping comments
// and then strings flags 047 — valid, already run — because it contains
// E'\n---\n', whose `---` is not a comment. The comment pass ate the closing
// quote, the string pass then mangled the rest, and a GROUP BY two lines below
// disappeared. A `--` inside a string is not a comment and a quote inside a
// comment is not a string; neither can be decided without reading once, in
// order.
function strippable(sql) {
  const source = sql.replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, ' BODY ')
  let out = ''
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "'") {
      i += 1
      while (i < source.length) {
        if (source[i] === "'") {
          if (source[i + 1] !== "'") break
          i += 1
        }
        i += 1
      }
      out += "''"
      continue
    }
    if (source[i] === '-' && source[i + 1] === '-') {
      while (i < source.length && source[i] !== '\n') i += 1
      out += '\n'
      continue
    }
    out += source[i]
  }
  return out
}

// Split on a delimiter that is at bracket depth zero.
function splitTop(text, delimiter) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (ch === delimiter && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

// The index of a keyword at bracket depth zero, or -1.
function indexOfTop(text, keyword) {
  const pattern = new RegExp(`\\b${keyword}\\b`, 'gi')
  let match = pattern.exec(text)
  while (match) {
    let depth = 0
    for (let i = 0; i < match.index; i += 1) {
      if (text[i] === '(') depth += 1
      else if (text[i] === ')') depth -= 1
    }
    if (depth === 0) return match.index
    match = pattern.exec(text)
  }
  return -1
}

// Remove balanced groups whose contents are a subquery. A column reference
// inside one is that subquery's business, not the enclosing select's.
function dropSubqueries(item) {
  let out = ''
  let depth = 0
  let groupStart = -1
  for (let i = 0; i < item.length; i += 1) {
    const ch = item[i]
    if (ch === '(') {
      if (depth === 0) groupStart = i
      depth += 1
    } else if (ch === ')') {
      depth -= 1
      if (depth === 0) {
        const inner = item.slice(groupStart + 1, i)
        out += /^\s*select\b/i.test(inner) ? ' ' : `(${dropSubqueries(inner)})`
        groupStart = -1
      }
    } else if (depth === 0) {
      out += ch
    }
  }
  return out
}

// The executable statements of a script, each labelled by what it does.
//
// ⚠️ `create ... as select` is ONE statement and is labelled ddl, not query.
// Splitting on top-level semicolons gives that for free: the select never
// starts a statement of its own.
function statementsOf(sql) {
  return splitTop(strippable(sql), ';')
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => {
      const head = text.toLowerCase()
      if (/^(alter|create|drop|comment\s+on|grant|revoke|truncate|insert|update|delete)\b/.test(head)) {
        return { kind: 'ddl', text }
      }
      if (/^(select|with)\b/.test(head)) return { kind: 'query', text }
      return { kind: 'other', text }
    })
}

module.exports = { strippable, splitTop, indexOfTop, dropSubqueries, statementsOf }
