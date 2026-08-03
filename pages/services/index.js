import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import ServicesTree from '../../components/ServicesTree'
import ResourcesManager from '../../components/ResourcesManager'
import ServicesSecondaryBar from '../../components/ServicesSecondaryBar'
import SetPricesDialog from '../../components/SetPricesDialog'
import { useServiceCatalog } from '../../hooks/useServiceCatalog'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'services', 'employees', 'settings', 'topBar'])),
    },
  }
}

export default function ServicesPage() {
  const { t } = useTranslation(['services', 'common'])
  // The catalogue is the screen. Resources is the one other thing that lives
  // here, and it is reached from the bar above rather than from a tab strip —
  // two tabs for two things was a row of chrome saying what one press says.
  const [view, setView] = useState('catalog')
  const [pricesOpen, setPricesOpen] = useState(false)
  const { categories, services, reload } = useServiceCatalog()

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <ServicesSecondaryBar
            onSetPrices={() => setPricesOpen(true)}
            onResources={() => setView((v) => (v === 'resources' ? 'catalog' : 'resources'))}
            resourcesActive={view === 'resources'}
          />

          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('services:breadcrumbServices')}</span>
              {' / '}
              <span>{t(view === 'resources' ? 'services:breadcrumbResources' : 'services:breadcrumbCatalog')}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            {view === 'catalog'
              ? <ServicesTree salonId={salonId} />
              : <ResourcesManager salonId={salonId} />}
          </div>

          <SetPricesDialog
            open={pricesOpen}
            onOpenChange={setPricesOpen}
            categories={categories}
            services={services}
            onSaved={reload}
          />
        </AppShell>
      )}
    </AuthGate>
  )
}
