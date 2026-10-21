import type { Habit } from '../../lib/database.types'
import type { DateStr } from '../../lib/dates'
import type { HabitLogMap } from '../../lib/schedule'
import type { VizConfig } from '../../lib/vizConfig'

/** compact = card in 2 columns, regular = card in 1 column, full = habit detail. */
export type VizSize = 'compact' | 'regular' | 'full'

export type VizProps = {
  habit: Habit
  logs: HabitLogMap
  today: DateStr
  size: VizSize
  config: VizConfig
}
