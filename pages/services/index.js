import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import ServicesTree from '../../components/ServicesTree'
import ServiceRolePricing from '../../components/ServiceRolePricing'
import ResourcesManager from '../../components/ResourcesManager'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'services', 'employees', 'settings', 'topBar'])),
    },
  }
}

export default function ServicesPage() {
  const { t } = useTranslation(['services', 'common'])
  const [tab, setTab] = useState('tree')

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('services:breadcrumbServices')}</span>
              {' / '}<span>{t(`services:breadcrumb${tab === 'tree' ? 'Catalog' : tab === 'pricing' ? 'Pricing' : 'Resources'}`)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="tree">{t('services:tabs.catalog')}</TabsTrigger>
                <TabsTrigger value="pricing">{t('services:tabs.rolePricing')}</TabsTrigger>
                <TabsTrigger value="resources">{t('services:tabs.resources')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {tab === 'tree' && <ServicesTree salonId={salonId} />}
            {tab === 'pricing' && <ServiceRolePricing />}
            {tab === 'resources' && <ResourcesManager salonId={salonId} />}
          </div>
        </AppShell>
      )}
    </AuthGate>
  )
}
