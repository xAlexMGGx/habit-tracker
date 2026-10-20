import { Navigate, createHashRouter } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AgendaPage } from './features/agenda/AgendaPage'
import { HabitFormPage } from './features/habits/HabitFormPage'
import { HabitListPage } from './features/habits/HabitListPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TrackerPage } from './features/tracker/TrackerPage'

// Hash routes (#/agenda): GitHub Pages has no SPA fallback, so a reload of
// /habit-tracker/agenda would 404. With the hash it always serves index.html.
export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/agenda" replace /> },
      { path: 'agenda', element: <AgendaPage /> },
      { path: 'tracker', element: <TrackerPage /> },
      { path: 'habits', element: <HabitListPage /> },
      { path: 'habits/new', element: <HabitFormPage /> },
      { path: 'habits/:id', element: <HabitFormPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/agenda" replace /> },
    ],
  },
])
