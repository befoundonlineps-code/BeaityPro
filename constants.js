export const SECTIONS = [
  { key: 'clients', label: 'الزبائن', active: true, icon: 'clients' },
  { key: 'appointments', label: 'دفتر المواعيد', active: false, icon: 'appointments' },
  { key: 'calls', label: 'المكالمات', active: false, icon: 'calls' },
  { key: 'products', label: 'المنتجات', active: false, icon: 'products' },
  { key: 'services', label: 'الخدمات', active: false, icon: 'services' },
  { key: 'groups', label: 'المجموعات', active: false, icon: 'groups' },
  { key: 'marketing', label: 'التسويق', active: false, icon: 'marketing' },
  { key: 'employees', label: 'الموظفون', active: false, icon: 'employees' },
  { key: 'salary', label: 'الرواتب', active: false, icon: 'salary' },
  { key: 'documents', label: 'المستندات', active: false, icon: 'documents' },
  { key: 'cash', label: 'الصندوق اليومي', active: false, icon: 'cash' },
  { key: 'reports', label: 'التقارير', active: false, icon: 'reports' },
  { key: 'settings', label: 'الإعدادات', active: false, icon: 'settings' },
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
