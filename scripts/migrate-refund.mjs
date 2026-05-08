#!/usr/bin/env node
/**
 * migrate-refund.mjs
 *
 * Converts legacy `transfer credit_card_refund` records (fromWallet === toWallet)
 * to `expense` records with a negative amount.
 *
 * Usage:
 *   node scripts/migrate-refund.mjs <vault-path>           # dry run
 *   node scripts/migrate-refund.mjs <vault-path> --confirm # apply
 */

import * as fs from 'fs'
import * as path from 'path'

const vaultPath = process.argv[2]
const confirm = process.argv.includes('--confirm')

if (!vaultPath) {
  console.error('Usage: node scripts/migrate-refund.mjs <vault-path> [--confirm]')
  process.exit(1)
}

const configPath = path.join(vaultPath, '.penny-wallet.json')
if (!fs.existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`)
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const folderName = config.folderName ?? 'PennyWallet'
const folderPath = path.join(vaultPath, folderName)

if (!fs.existsSync(folderPath)) {
  console.error(`Wallet folder not found: ${folderPath}`)
  process.exit(1)
}

const files = fs.readdirSync(folderPath).filter(f => /^\d{4}-\d{2}\.md$/.test(f)).sort()
let totalConverted = 0

for (const file of files) {
  const filePath = path.join(folderPath, file)
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  const converted = []
  let changed = false

  const updated = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) return line

    const cols = trimmed.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
    if (cols.length < 8) return line

    const [date, type, , fromWallet, toWallet, category, note] = cols
    if (type !== 'transfer' || category !== 'credit_card_refund') return line
    if (fromWallet !== toWallet || !fromWallet || fromWallet === '-') return line

    // Parse amount — supports 8, 9, or 10 column formats
    let amountStr
    if (cols.length === 8) amountStr = cols[7]
    else if (cols.length === 9) amountStr = /^-?\d+(\.\d+)?$/.test(cols[7]) ? cols[7] : cols[8]
    else amountStr = cols[8]

    const amount = parseFloat(amountStr)
    if (isNaN(amount)) return line

    // Build replacement row: expense, wallet=fromWallet, from=-, to=-, category=-, negative amount
    const tagsCol = cols.length >= 9 && !/^-?\d+(\.\d+)?$/.test(cols[7]) ? cols[7] : '-'
    const createdAt = cols.length === 10 ? cols[9] : cols.length === 9 && /^-?\d+(\.\d+)?$/.test(cols[7]) ? cols[8] : '-'
    const newRow = `| ${date} | expense | ${fromWallet} | - | - | - | ${note} | ${tagsCol} | ${-amount} | ${createdAt} |`

    converted.push({ file, date, wallet: fromWallet, amount, note })
    changed = true
    return newRow
  })

  if (changed) {
    // Recompute frontmatter income/expense
    let income = 0
    let expense = 0
    for (const line of updated) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('|')) continue
      const cols = trimmed.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1)
      if (cols.length < 8 || cols[0] === 'Date' || cols[0] === '日期') continue
      let amountStr
      if (cols.length === 8) amountStr = cols[7]
      else if (cols.length === 9) amountStr = /^-?\d+(\.\d+)?$/.test(cols[7]) ? cols[7] : cols[8]
      else amountStr = cols[8]
      const amt = parseFloat(amountStr)
      if (isNaN(amt)) continue
      if (cols[1] === 'income') income += amt
      else if (cols[1] === 'expense') expense += amt
    }

    const newContent = updated.join('\n').replace(
      /^---\n[\s\S]*?\n---/m,
      `---\nincome: ${income}\nexpense: ${expense}\nnetAsset: 0\n---`
    )

    console.log(`\n${file}: ${converted.length} record(s) to convert`)
    for (const r of converted) {
      console.log(`  ${r.date} | ${r.wallet} | ${r.note} | ${r.amount} → expense -${r.amount}`)
    }

    if (confirm) {
      fs.writeFileSync(filePath, newContent, 'utf8')
      console.log(`  ✓ Written`)
    }

    totalConverted += converted.length
  }
}

if (totalConverted === 0) {
  console.log('No credit_card_refund records found.')
} else if (!confirm) {
  console.log(`\nDry run: ${totalConverted} record(s) would be converted. Re-run with --confirm to apply.`)
} else {
  console.log(`\nDone: ${totalConverted} record(s) converted.`)
}
