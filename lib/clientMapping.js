export function buildClientPayload(form) {
  return {
    first_name: form.firstName, last_name: form.lastName, gender: form.gender || null,
    category: form.category || null, phone_number: form.phone,
    birthday: form.birthday || null,
    email: form.email || null,
    email_opt_out: form.emailOptOut, facebook_url: form.facebook || null,
    whatsapp_number: form.whatsapp || null, instagram_handle: form.instagram || null,
    acquisition_source_id: form.acquisitionSourceId || null, utm_campaign: form.utmCampaign || null,
    utm_source: form.utmSource || null, utm_medium: form.utmMedium || null,
    card_number: form.cardNumber || null, max_debt_limit: form.maxDebt || 0,
    preferred_professional: form.preferredProfessional || null, company_name: form.companyName || null,
    position_title: form.positionTitle || null, address_index: form.addressIndex || null,
    address_city: form.addressCity || null, address_street: form.addressStreet || null,
    address_building: form.addressBuilding || null,
    registration_address_differs: form.registrationAddressDiffers,
    passport_series: form.passportSeries || null,
    passport_number: form.passportNumber || null, passport_issued_date: form.passportIssuedDate || null,
    passport_issued_by: form.passportIssuedBy || null, identification_code: form.identificationCode || null,
  }
}

export function clientToForm(c) {
  return {
    firstName: c.first_name || '', lastName: c.last_name || '', gender: c.gender || '', category: c.category || '',
    phone: c.phone_number || '', birthday: c.birthday || '',
    email: c.email || '', emailOptOut: !!c.email_opt_out, facebook: c.facebook_url || '', whatsapp: c.whatsapp_number || '', instagram: c.instagram_handle || '',
    acquisitionSourceId: c.acquisition_source_id || '', utmCampaign: c.utm_campaign || '', utmSource: c.utm_source || '', utmMedium: c.utm_medium || '',
    cardNumber: c.card_number || '', maxDebt: c.max_debt_limit || 0, preferredProfessional: c.preferred_professional || '', companyName: c.company_name || '',
    positionTitle: c.position_title || '', addressIndex: c.address_index || '', addressCity: c.address_city || '', addressStreet: c.address_street || '',
    addressBuilding: c.address_building || '', registrationAddressDiffers: !!c.registration_address_differs,
    passportSeries: c.passport_series || '', passportNumber: c.passport_number || '', passportIssuedDate: c.passport_issued_date || '',
    passportIssuedBy: c.passport_issued_by || '', identificationCode: c.identification_code || '',
  }
}
