const {
  folderIdsOfStorage, scopedFolderIds, destinationNarrows,
} = require('./supplyDestinationScope')

// العدسةُ `s1` وفيها ثلاثةُ مجلّدات. والوجهاتُ الثلاثُ هي حالاتُ المالك الثلاث
// بالضبط — والرابعةُ (`s4`) موجودةٌ لأنها الحالةُ التي تفرّق التقاطعَ عن
// الاتّحاد، ولا تظهر في أيِّ لقطةٍ من لقطات المرجع.
const links = [
  { storage_id: 's1', category_id: 'a' },
  { storage_id: 's1', category_id: 'b' },
  { storage_id: 's1', category_id: 'c' },

  { storage_id: 's2', category_id: 'a' },   // كلُّها
  { storage_id: 's2', category_id: 'b' },
  { storage_id: 's2', category_id: 'c' },

  { storage_id: 's3', category_id: 'b' },   // بعضُها

  // 🔴 لا مشتركَ إطلاقًا — وله مجلّدٌ خاصٌّ به.
  { storage_id: 's4', category_id: 'z' },
]

const selected = ['a', 'b', 'c']

describe('حالاتُ المالك الثلاث', () => {
  it('الوجهةُ فيها كلُّ مجلّدات العدسة ⟵ كلُّها تظهر', () => {
    expect(scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's2' }))
      .toEqual(['a', 'b', 'c'])
  })

  it('فيها بعضُها ⟵ المشتركةُ وحدَها', () => {
    expect(scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's3' }))
      .toEqual(['b'])
  })

  it('ولا مجلّدَ مشترك ⟵ ولا صفّ', () => {
    expect(scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's4' }))
      .toEqual([])
  })
})

describe('تقاطعٌ لا اتّحاد', () => {
  it('مجلّداتُ الوجهةِ الخاصّةُ لا تدخل الجدول', () => {
    // 🔴 الحالةُ التي لا تفرّقها أيُّ لقطة. `s4` له `z` ولا شيءَ مشترك:
    // التقاطعُ فارغٌ، والاتّحادُ كان سيرسم صفًّا لمجلّدٍ لم يؤشّره أحد.
    const kept = scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's4' })
    expect(kept).not.toContain('z')
    expect(kept).toEqual([])
  })

  it('وحتى حين يكون هناك مشتركٌ، لا يُضاف الخاصّ', () => {
    // `s3` فيه `b` مشتركًا. ولو أُضيف إليه خاصٌّ لظهر تحت الاتّحاد.
    const withOwn = [...links, { storage_id: 's3', category_id: 'y' }]
    const kept = scopedFolderIds({ selectedFolderIds: selected, links: withOwn, toStorageId: 's3' })
    expect(kept).toEqual(['b'])
  })
})

describe('التضييقُ عرضٌ لا حذف', () => {
  it('التبديلُ ذهابًا وإيابًا لا يأكل المجلّدات', () => {
    // 🔴 **الفخُّ الذي يُبنى مرّةً ويُكتشف بعد شهر.** لو صُفِّي الاختيارُ نفسُه
    // عند كلّ تغيير، لأسقط `s3` غيرَ المشترك، ثمّ لا يعيده الرجوعُ إلى `s2` —
    // بلا رسالةٍ ولا سطرٍ يشتكي، الجدولُ ينقص فقط.
    const atS3 = scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's3' })
    expect(atS3).toEqual(['b'])

    // والاختيارُ الأصليُّ هو ما يُمرَّر ثانيةً، لا نتيجةُ التضييق.
    const backAtS2 = scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's2' })
    expect(backAtS2).toEqual(['a', 'b', 'c'])
  })

  it('يقول ما اختفى، لا ما بقي وحدَه', () => {
    const answer = destinationNarrows({ selectedFolderIds: selected, links, toStorageId: 's3' })
    expect(answer.kept).toEqual(['b'])
    expect(answer.hidden).toEqual(['a', 'c'])
    expect(answer.empty).toBe(false)
  })

  it('الفراغُ حالةٌ تُقال، ويُميَّز عن «لم يُؤشَّر شيءٌ أصلًا»', () => {
    // ⚠️ اختيارٌ فارغٌ من البداية ليس «لا مجلّدَ مشترك» — الأوّلُ يسبق الوجهةَ
    // والثاني نتيجتُها، وجملةٌ واحدةٌ لهما تشرح الحالةَ الخطأ. وهي العلّةُ
    // نفسُها التي وقعت في خانتَي الغرامة: الرفضُ صحيحٌ والسببُ المعروضُ ليس سببَه.
    expect(destinationNarrows({ selectedFolderIds: selected, links, toStorageId: 's4' }).empty).toBe(true)
    expect(destinationNarrows({ selectedFolderIds: [], links, toStorageId: 's4' }).empty).toBe(false)
  })
})

describe('الحدود', () => {
  it('لا وجهةَ = لا تضييق', () => {
    // الحقلُ يُملأ افتراضيًّا بمستودع العدسة، وفراغُه حالةٌ عابرةٌ أثناء التغيير.
    // وتضييقٌ إلى لا شيءٍ عندها يُفرغ الجدولَ فجأةً ويبدو عطلًا.
    expect(scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: '' })).toEqual(selected)
    expect(scopedFolderIds({ selectedFolderIds: selected, links })).toEqual(selected)
  })

  it('الوجهةُ هي العدسةُ نفسُها ⟵ كلُّ ما أُشّر يبقى', () => {
    expect(scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 's1' }))
      .toEqual(['a', 'b', 'c'])
  })

  it('مستودعٌ بلا روابطَ إطلاقًا يُفرغ الجدول ولا ينهار', () => {
    expect(folderIdsOfStorage(links, 'ما-في').size).toBe(0)
    expect(scopedFolderIds({ selectedFolderIds: selected, links, toStorageId: 'ما-في' })).toEqual([])
  })

  it('لا روابطَ ولا اختيارَ ⟵ لا انهيار', () => {
    expect(scopedFolderIds({})).toEqual([])
    expect(folderIdsOfStorage(null, 's1').size).toBe(0)
  })
})
