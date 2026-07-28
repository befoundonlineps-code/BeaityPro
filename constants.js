export const SECTIONS = [
  { key: 'clients', active: true, icon: 'clients', route: '/' },
  { key: 'appointments', active: false, icon: 'appointments' },
  { key: 'calls', active: false, icon: 'calls' },
  { key: 'products', active: false, icon: 'products' },
  { key: 'services', active: false, icon: 'services' },
  { key: 'groups', active: false, icon: 'groups' },
  { key: 'marketing', active: false, icon: 'marketing' },
  { key: 'employees', active: false, icon: 'employees' },
  { key: 'salary', active: false, icon: 'salary' },
  { key: 'documents', active: false, icon: 'documents' },
  { key: 'cash', active: false, icon: 'cash' },
  { key: 'reports', active: false, icon: 'reports' },
  { key: 'settings', active: true, icon: 'settings', route: '/settings' },
]

export const emptyForm = {
  firstName: '', lastName: '', gender: '', categoryId: '', phone: '',
  birthday: '',
  email: '', emailOptOut: false, facebook: '', whatsapp: '', instagram: '',
  acquisitionSourceId: '', utmCampaign: '', utmSource: '', utmMedium: '',
  cardNumber: '', maxDebt: 0, preferredProfessional: '', companyName: '', positionTitle: '',
  addressIndex: '', addressCity: '', addressStreet: '', addressBuilding: '',
  registrationAddressDiffers: false,
  passportSeries: '', passportNumber: '', passportIssuedDate: '', passportIssuedBy: '',
  identificationCode: '',
}
