import { linkDiff, linksFor } from './resourceLinks'

describe('linkDiff', () => {
  const existing = [
    { id: 'row1', service_id: 'svc', resource_id: 'r1' },
    { id: 'row2', service_id: 'svc', resource_id: 'r2' },
  ]

  it('adds what was ticked and was not linked', () => {
    expect(linkDiff(existing, ['r1', 'r2', 'r3'], 'resource_id'))
      .toEqual({ toAdd: ['r3'], toRemoveIds: [] })
  })

  it('removes the row of what was unticked', () => {
    expect(linkDiff(existing, ['r1'], 'resource_id'))
      .toEqual({ toAdd: [], toRemoveIds: ['row2'] })
  })

  it('does both at once when one resource replaces another', () => {
    expect(linkDiff(existing, ['r1', 'r9'], 'resource_id'))
      .toEqual({ toAdd: ['r9'], toRemoveIds: ['row2'] })
  })

  it('asks for nothing when nothing changed', () => {
    expect(linkDiff(existing, ['r2', 'r1'], 'resource_id'))
      .toEqual({ toAdd: [], toRemoveIds: [] })
  })

  it('clears every row when the selection empties', () => {
    expect(linkDiff(existing, [], 'resource_id'))
      .toEqual({ toAdd: [], toRemoveIds: ['row1', 'row2'] })
  })

  it('never asks to insert the same id twice', () => {
    // unique(service_id, resource_id) would reject the batch, and the valid
    // rows sent alongside it would go down with it.
    expect(linkDiff([], ['r3', 'r3', 'r4'], 'resource_id'))
      .toEqual({ toAdd: ['r3', 'r4'], toRemoveIds: [] })
  })

  it('works from the resource side with the other column', () => {
    const links = [
      { id: 'row1', service_id: 's1', resource_id: 'res' },
      { id: 'row2', service_id: 's2', resource_id: 'res' },
    ]
    expect(linkDiff(links, ['s2', 's3'], 'service_id'))
      .toEqual({ toAdd: ['s3'], toRemoveIds: ['row1'] })
  })

  it('survives null on either side', () => {
    expect(linkDiff(null, null, 'resource_id')).toEqual({ toAdd: [], toRemoveIds: [] })
    expect(linkDiff(null, ['r1'], 'resource_id')).toEqual({ toAdd: ['r1'], toRemoveIds: [] })
    expect(linkDiff(existing, null, 'resource_id')).toEqual({ toAdd: [], toRemoveIds: ['row1', 'row2'] })
  })
})

describe('linksFor', () => {
  const all = [
    { id: 'a', service_id: 's1', resource_id: 'r1' },
    { id: 'b', service_id: 's2', resource_id: 'r1' },
    { id: 'c', service_id: 's1', resource_id: 'r2' },
  ]

  it('picks out one service’s links', () => {
    expect(linksFor(all, 'service_id', 's1').map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('picks out one resource’s links', () => {
    expect(linksFor(all, 'resource_id', 'r1').map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('is empty for a service that has none', () => {
    expect(linksFor(all, 'service_id', 's9')).toEqual([])
  })

  it('is empty rather than everything when there is no id yet', () => {
    // A service being created has no id. Matching undefined against rows would
    // hand the new service every link in the salon.
    expect(linksFor(all, 'service_id', null)).toEqual([])
    expect(linksFor(all, 'service_id', undefined)).toEqual([])
  })
})
