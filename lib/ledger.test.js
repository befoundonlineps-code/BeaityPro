import { computeBalance } from './ledger'

describe('computeBalance', () => {
  it('returns 0 for no transactions', () => {
    expect(computeBalance([])).toBe(0)
    expect(computeBalance(null)).toBe(0)
  })

  it('adds credits and subtracts debits', () => {
    const rows = [
      { type: 'credit', amount: 100 },
      { type: 'debit', amount: 30 },
      { type: 'credit', amount: 20 },
    ]
    expect(computeBalance(rows)).toBe(90)
  })
})
