import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import WorkingHoursSettings from '../../components/WorkingHoursSettings'
import BusinessTypesSettings from '../../components/BusinessTypesSettings'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'settings', 'topBar'])),
    },
  }
}

export default function SettingsPage() {
  const { t } = useTranslation(['settings', 'common'])
  const router = useRouter()
  const [tab, setTab] = useState('workingHours')

  // Lets other screens deep-link straight to a tab, e.g. /settings?tab=businessTypes
  useEffect(() => {
    const requested = router.query.tab
    if (requested === 'workingHours' || requested === 'businessTypes') setTab(requested)
  }, [router.query.tab])

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{t('settings:breadcrumb')}</span>
              {' / '}<span>{t(`settings:tabs.${tab}`)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="workingHours">{t('settings:tabs.workingHours')}</TabsTrigger>
                <TabsTrigger value="businessTypes">{t('settings:tabs.businessTypes')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {tab === 'workingHours' && <WorkingHoursSettings />}
            {tab === 'businessTypes' && <BusinessTypesSettings salonId={salonId} />}
          </div>
        </AppShell>
      )}
    </AuthGate>
  )
}
