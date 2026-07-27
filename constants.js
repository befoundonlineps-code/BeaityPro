export const SECTIONS = [
  { key: 'clients', label: 'الزبائن', active: true },
  { key: 'appointments', label: 'دفتر المواعيد', active: false },
  { key: 'calls', label: 'المكالمات', active: false },
  { key: 'products', label: 'المنتجات', active: false },
  { key: 'services', label: 'الخدمات', active: false },
  { key: 'groups', label: 'المجموعات', active: false },
  { key: 'marketing', label: 'التسويق', active: false },
  { key: 'employees', label: 'الموظفون', active: false },
  { key: 'salary', label: 'الرواتب', active: false },
  { key: 'documents', label: 'المستندات', active: false },
  { key: 'cash', label: 'الصندوق اليومي', active: false },
  { key: 'reports', label: 'التقارير', active: false },
  { key: 'settings', label: 'الإعدادات', active: false },
]

export const CATEGORY_OPTIONS = [
  { value: '', label: 'بدون' },
  { value: 'blacklist', label: 'قائمة سوداء' },
  { value: 'family_friends', label: 'عائلة / أصدقاء' },
  { value: 'vip', label: 'VIP' },
]

export const TABS = ['معلومات عامة', 'التواصل والتسويق', 'المعلومات المالية', 'العنوان والوثائق']

export const emptyForm = {
  firstName: '', lastName: '', gender: '', category: '', phone: '',
  birthday: '',
  email: '', emailOptOut: false, facebook: '', viber: '', instagram: '',
  acquisitionSource: '', utmCampaign: '', utmSource: '', utmMedium: '',
  cardNumber: '', maxDebt: 0, preferredProfessional: '', companyName: '', positionTitle: '',
  addressIndex: '', addressCity: '', addressStreet: '', addressBuilding: '',
  registrationAddressDiffers: false,
  passportSeries: '', passportNumber: '', passportIssuedDate: '', passportIssuedBy: '',
  identificationCode: '',
}
