import { CalendarCheck, LayoutGrid, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import s from './TabBar.module.css'

export function TabBar() {
  const { t } = useTranslation()
  const tabs = [
    { to: '/agenda', label: t('nav.agenda'), Icon: CalendarCheck },
    { to: '/tracker', label: t('nav.tracker'), Icon: LayoutGrid },
    { to: '/habits', label: t('nav.habits'), Icon: ListChecks },
  ]
  return (
    <nav className={s.bar}>
      {tabs.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? `${s.tab} ${s.active}` : s.tab)}>
          <Icon size={25} strokeWidth={1.9} aria-hidden />
          <span className={s.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
