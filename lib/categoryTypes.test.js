import { effectiveBusinessType, indexCategoriesById } from './categoryTypes'

const categories = [
  // Classic shape: typed root, untyped children inheriting from it.
  { id: 'hair', parent_id: null, business_type: 'hairdressing' },
  { id: 'hair-cut', parent_id: 'hair', business_type: null },
  { id: 'hair-cut-kids', parent_id: 'hair-cut', business_type: null },

  // Mixed folder: untyped root whose children each declare their own type.
  { id: 'bridal', parent_id: null, business_type: null },
  { id: 'bridal-hair', parent_id: 'bridal', business_type: 'hairdressing' },
  { id: 'bridal-makeup', parent_id: 'bridal', business_type: 'makeup' },
  { id: 'bridal-makeup-extra', parent_id: 'bridal-makeup', business_type: null },

  // A child that overrides the type its parent would have given it.
  { id: 'hair-makeup', parent_id: 'hair', business_type: 'makeup' },
]

const byId = indexCategoriesById(categories)

describe('effectiveBusinessType', () => {
  it('uses the category\'s own type when it has one', () => {
    expect(effectiveBusinessType(byId['hair'], byId)).toBe('hairdressing')
  })

  it('inherits from the parent when the category has none', () => {
    expect(effectiveBusinessType(byId['hair-cut'], byId)).toBe('hairdressing')
  })

  it('walks up more than one level to find the nearest typed ancestor', () => {
    expect(effectiveBusinessType(byId['hair-cut-kids'], byId)).toBe('hairdressing')
  })

  it('lets a child override what it would have inherited', () => {
    expect(effectiveBusinessType(byId['hair-makeup'], byId)).toBe('makeup')
  })

  it('resolves each child of an untyped root to its own type', () => {
    expect(effectiveBusinessType(byId['bridal-hair'], byId)).toBe('hairdressing')
    expect(effectiveBusinessType(byId['bridal-makeup'], byId)).toBe('makeup')
    expect(effectiveBusinessType(byId['bridal-makeup-extra'], byId)).toBe('makeup')
  })

  it('returns null for a category with no typed ancestor (general)', () => {
    expect(effectiveBusinessType(byId['bridal'], byId)).toBeNull()
  })

  it('tolerates a missing parent instead of throwing', () => {
    const orphan = { id: 'orphan', parent_id: 'gone', business_type: null }
    expect(effectiveBusinessType(orphan, byId)).toBeNull()
  })

  it('does not loop forever on a cyclic parent chain', () => {
    const cyclic = indexCategoriesById([
      { id: 'a', parent_id: 'b', business_type: null },
      { id: 'b', parent_id: 'a', business_type: null },
    ])
    expect(effectiveBusinessType(cyclic['a'], cyclic)).toBeNull()
  })

  it('handles null input safely', () => {
    expect(effectiveBusinessType(null, byId)).toBeNull()
    expect(effectiveBusinessType(byId['hair-cut'], null)).toBeNull()
  })
})
