// rows: array of { type: 'credit' | 'debit', amount: number }
export function computeBalance(rows) {
  return (rows || []).reduce((total, row) => {
    return row.type === 'credit' ? total + Number(row.amount) : total - Number(row.amount)
  }, 0)
}
