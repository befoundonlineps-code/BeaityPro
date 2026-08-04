import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import WorkingHoursSettings from '../../components/WorkingHoursSettings'
import BusinessTypesSettings from '../../components/BusinessTypesSettings'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { sectionTab, sectionQuery } from '../../lib/sectionTabs'

const TABS = ['workingHours', 'businessTypes']

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
  // ⚠️ This page had the half-measure, and a half-measure was worse than
  // neither: an effect copied router.query.tab into state so other screens
  // could deep-link in, while pressing a tab wrote nothing back. The address
  // was right on arrival and a lie from the first press after it — and the
  // deep link that came in could not be sent back out.
  //
  // Derived from the URL now, in both directions, per lib/sectionTabs.js.
  const tab = sectionTab(TABS, router.query.tab)
  const setTab = (next) =>
    router.push({ pathname: '/settings', query: sectionQuery(TABS, next) }, undefined, { shallow: true })

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
