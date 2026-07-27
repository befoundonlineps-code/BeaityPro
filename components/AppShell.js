import { useState } from 'react'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'

export default function AppShell({ userEmail, onLogout, children }) {
  const [notice, setNotice] = useState(null)

  function handleDisabledSection(label) {
    setNotice(`قسم "${label}" قيد التطوير — سيُبنى بنفس الأساس الحالي بالمراحل القادمة`)
    setTimeout(() => setNotice(null), 4000)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader userEmail={userEmail} onLogout={onLogout} />
      <Sidebar onDisabledClick={handleDisabledSection} />
      <main className="flex-1 overflow-y-auto">
        {notice && (
          <div className="mx-5 mt-4 rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400">
            {notice}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
