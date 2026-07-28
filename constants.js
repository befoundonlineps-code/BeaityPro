export const SECTIONS = [
  { key: 'clients', active: true, icon: 'clients', route: '/' },
  { key: 'appointments', active: true, icon: 'appointments', route: '/appointments' },
  { key: 'calls', active: false, icon: 'calls' },
  { key: 'products', active: false, icon: 'products' },
  { key: 'services', active: true, icon: 'services', route: '/services' },
  { key: 'groups', active: false, icon: 'groups' },
  { key: 'marketing', active: false, icon: 'marketing' },
  { key: 'employees', active: true, icon: 'employees', route: '/employees' },
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
