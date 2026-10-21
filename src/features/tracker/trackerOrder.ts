import type { TrackerSort } from '../../lib/database.types'
import type { HabitStats } from '../../lib/stats'

type Sortable = { id: string; sort_order: number; created_at: string }

/**
 * Orders the tracker cards. Automatic orders never touch sort_order, so going back
 * to "manual" restores the user's order exactly (SPEC §6). Ties keep the manual order.
 */
export function orderHabits<H extends Sortable>(
  habits: readonly H[],
  mode: TrackerSort,
  stats: ReadonlyMap<string, HabitStats>,
  pendingToday: ReadonlySet<string>,
): H[] {
  const manual = [...habits].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
  switch (mode) {
    case 'manual':
      return manual
    case 'streak':
      return manual.sort((a, b) => (stats.get(b.id)?.currentStreak ?? 0) - (stats.get(a.id)?.currentStreak ?? 0))
    case 'completion':
      // Last 30 days; habits without data yet go last.
      return manual.sort((a, b) => (stats.get(b.id)?.last30.pct ?? -1) - (stats.get(a.id)?.last30.pct ?? -1))
    case 'pending_first':
      return manual.sort((a, b) => Number(pendingToday.has(b.id)) - Number(pendingToday.has(a.id)))
  }
}
