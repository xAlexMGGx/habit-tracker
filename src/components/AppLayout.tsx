import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import s from './AppLayout.module.css'
import { TabBar } from './TabBar'

/** Pages pushed on top of the tabs (no tab bar): settings, the habit form and the habit detail. */
const FULL_SCREEN = [/^\/settings/, /^\/habits\/.+/, /^\/tracker\/.+/]

export function AppLayout() {
  const { pathname } = useLocation()
  const fullScreen = FULL_SCREEN.some((re) => re.test(pathname))

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      {/* Keeps scrolled content from showing through the status bar */}
      <div className={s.statusBar} aria-hidden />
      <main>
        <Outlet />
      </main>
      {fullScreen ? null : <TabBar />}
    </>
  )
}
