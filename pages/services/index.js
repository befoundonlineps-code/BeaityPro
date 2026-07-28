import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useAuthSession } from '../../hooks/useAuthSession'
import LoginScreen from '../../components/LoginScreen'
import AppShell from '../../components/AppShell'
import ServicesTree from '../../components/ServicesTree'
import ServiceRolePricing from '../../components/ServiceRolePricing'
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
  const { session, salonId, loading, logout } = useAuthSession()
  const [tab, setTab] = useState('tree')

  const PAGE_LOADING = (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">{t('common:loading')}</div>
  )

  if (session === undefined) return PAGE_LOADING
  if (!session) return <LoginScreen />
  if (loading) return PAGE_LOADING

  return (
    <AppShell userEmail={session.user.email} onLogout={logout}>
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-primary">{t('services:breadcrumbServices')}</span>
          {' / '}<span>{tab === 'tree' ? t('services:breadcrumbCatalog') : t('services:breadcrumbPricing')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="tree">{t('services:tabs.catalog')}</TabsTrigger>
            <TabsTrigger value="pricing">{t('services:tabs.rolePricing')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'tree' && <ServicesTree salonId={salonId} />}
        {tab === 'pricing' && <ServiceRolePricing />}
      </div>
    </AppShell>
  )
}
