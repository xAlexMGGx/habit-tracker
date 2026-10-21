import type { VizType } from '../../lib/database.types'
import { habitColorStyle } from '../../lib/habitMeta'
import { effectiveViz } from '../../lib/vizConfig'
import { Bars } from './Bars'
import { DaysSince } from './DaysSince'
import { Heatmap } from './Heatmap'
import { MonthCalendar } from './MonthCalendar'
import { Ring } from './Ring'
import type { VizProps } from './types'

/** Draws a habit with its chosen visualization, or with `viz` when given (detail, guide, preview). */
export function HabitViz({ viz, ...props }: VizProps & { viz?: VizType }) {
  const kind = viz ?? effectiveViz(props.habit)
  const view = (() => {
    switch (kind) {
      case 'heatmap':
        return <Heatmap {...props} />
      case 'calendar':
        return <MonthCalendar {...props} />
      case 'ring':
        return <Ring {...props} />
      case 'bars':
        return <Bars {...props} />
      case 'days_since':
        return <DaysSince {...props} />
      default:
        return <Heatmap {...props} />
    }
  })()
  return <div style={habitColorStyle(props.habit.color)}>{view}</div>
}
