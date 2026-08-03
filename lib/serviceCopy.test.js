import { copyName, serviceCopyPayload } from './serviceCopy'

const SUFFIX = ' — نسخة'
const numbered = (base, n) => `${base} ${n}`

describe('copyName', () => {
  it('appends the suffix when the name is free', () => {
    expect(copyName('قص شعر', ['قص شعر'], SUFFIX, numbered)).toBe('قص شعر — نسخة')
  })

  it('numbers the second copy', () => {
    expect(copyName('قص شعر', ['قص شعر', 'قص شعر — نسخة'], SUFFIX, numbered))
      .toBe('قص شعر — نسخة 2')
  })

  it('keeps counting past the numbered ones', () => {
    const taken = ['قص شعر', 'قص شعر — نسخة', 'قص شعر — نسخة 2', 'قص شعر — نسخة 3']
    expect(copyName('قص شعر', taken, SUFFIX, numbered)).toBe('قص شعر — نسخة 4')
  })

  it('copes with no existing names at all', () => {
    expect(copyName('قص شعر', null, SUFFIX, numbered)).toBe('قص شعر — نسخة')
  })
})

describe('serviceCopyPayload', () => {
  const service = {
    id: 's1',
    salon_id: 'old-salon',
    category_id: 'old-cat',
    name: 'قص شعر',
    duration_minutes: 45,
    price: 80,
    color: '#7C3AED',
    sex: 'women',
    sort_order: 3,
    is_active: false,
    created_at: '2020-01-01T00:00:00Z',
  }
  const made = serviceCopyPayload(service, { categoryId: 'new-cat', salonId: 'new-salon', name: 'قص شعر — نسخة' })

  it('carries every column the form can set', () => {
    expect(made).toMatchObject({
      duration_minutes: 45, price: 80, color: '#7C3AED', sex: 'women', sort_order: 3,
    })
  })

  it('takes the category and salon from the caller, not the original', () => {
    // A copy lands where the person copying is standing.
    expect(made.category_id).toBe('new-cat')
    expect(made.salon_id).toBe('new-salon')
  })

  it('never carries id or created_at', () => {
    expect(made.id).toBeUndefined()
    expect(made.created_at).toBeUndefined()
  })

  it('starts active even when the original was archived', () => {
    // Copying an archived service is how somebody revives an old offering;
    // inheriting is_active would put it back on the price list silently.
    expect(service.is_active).toBe(false)
    expect(made.is_active).toBe(true)
  })

  it('leaves out a column the original does not have', () => {
    const sparse = serviceCopyPayload(
      { name: 'x', duration_minutes: 30 },
      { categoryId: 'c', salonId: 's', name: 'x — نسخة' }
    )
    expect(sparse).toEqual({
      name: 'x — نسخة', category_id: 'c', salon_id: 's', is_active: true, duration_minutes: 30,
    })
  })

  it('is nothing at all without a service', () => {
    expect(serviceCopyPayload(null, { categoryId: 'c', salonId: 's', name: 'x' })).toBe(null)
  })
})
