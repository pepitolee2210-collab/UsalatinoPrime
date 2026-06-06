// Resume scripts/i485-tooltips.json agrupando por la "Part N" REAL extraída del
// tooltip oficial de USCIS (no por el prefijo interno Pt# del field-name, que
// el generador usó mal). Herramienta de desarrollo para curar i485-client-form.ts.
//
// Uso:
//   node scripts/summarize-i485-tooltips.mjs counts      -> conteo por parte real
//   node scripts/summarize-i485-tooltips.mjs 1           -> detalle de la Part 1
//   node scripts/summarize-i485-tooltips.mjs all          -> todo

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'i485-tooltips.json'), 'utf8'))

const arg = process.argv[2] || 'counts'

// Modo 'find <regex>': lista los campos cuyo tooltip casa con el patrón, con su
// semanticKey y on-value. Para verificar a qué campo real corresponde una etiqueta.
if (arg === 'find') {
  const re = new RegExp(process.argv[3] || '.', 'i')
  for (const f of data.fields) {
    if (re.test(f.tooltip || '')) {
      const tip = (f.tooltip || '').replace(/\s+/g, ' ').trim()
      console.log(`${f.semanticKey}  [${f.type}${f.onValue ? ' on=' + f.onValue : ''}]\n    ${tip}`)
    }
  }
  process.exit(0)
}
const groups = {}
const order = []
for (const f of data.fields) {
  const m = (f.tooltip || '').match(/Part\s+(\d+)\./i)
  const part = m ? m[1] : 'X'
  if (!groups[part]) { groups[part] = []; order.push(part) }
  groups[part].push(f)
}
order.sort((a, b) => (a === 'X' ? 99 : +a) - (b === 'X' ? 99 : +b))

if (arg === 'counts') {
  for (const p of order) console.log(`Part ${p}: ${groups[p].length} campos`)
  process.exit(0)
}

// Modo 'uniq <part>': agrupa por la PRIMERA oración del tooltip (la pregunta/etiqueta
// base) para revelar cuántas preguntas DISTINTAS hay vs repeticiones/continuaciones.
if (arg === 'uniq') {
  const target = process.argv[3]
  const parts = target ? [target] : order
  for (const p of parts) {
    const byBase = new Map()
    for (const f of groups[p] || []) {
      const tip = (f.tooltip || '').replace(/\s+/g, ' ').trim()
      // Quitar el prefijo "Part N. ItemM." para revelar la pregunta/etiqueta real.
      const base = tip.replace(/^Part\s+\d+\.\s*/i, '').slice(0, 110)
      if (!byBase.has(base)) byBase.set(base, [])
      byBase.get(base).push(f)
    }
    console.log(`\n===== PART ${p}: ${(groups[p] || []).length} campos, ${byBase.size} etiquetas únicas =====`)
    for (const [base, arr] of byBase) {
      console.log(`(${arr.length}x) ${base}`)
    }
  }
  process.exit(0)
}

const parts = arg === 'all' ? order : [arg]
for (const p of parts) {
  console.log(`\n===== PART ${p} (${(groups[p] || []).length} campos) =====`)
  for (const f of groups[p] || []) {
    const tip = (f.tooltip || '').replace(/\s+/g, ' ').trim()
    const meta = `${f.type}${f.onValue ? ' on=' + f.onValue : ''}${f.maxLength ? ' max=' + f.maxLength : ''}`
    console.log(`${f.semanticKey}  [${meta}]\n    ${tip}`)
  }
}
