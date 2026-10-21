import type { Habit, HabitType, Json, VizType } from './database.types'
import { DEFAULT_VIZ, VIZ_BY_TYPE } from './habitMeta'
import type { JarCapacity, JarConfig, JarPeriod } from './jar'

/** Visualizations that have a component. */
export const IMPLEMENTED_VIZ: VizType[] = ['heatmap', 'calendar', 'ring', 'bars', 'days_since', 'marble_jar', 'plant']

/** Compatible visualizations that can be shown today, in the SPEC's order. */
export function availableViz(type: HabitType): VizType[] {
  return VIZ_BY_TYPE[type].filter((v) => IMPLEMENTED_VIZ.includes(v))
}

/** The habit's chosen visualization, or its type's default if that one isn't available. */
export function effectiveViz(habit: Pick<Habit, 'type' | 'viz_type'>): VizType {
  return IMPLEMENTED_VIZ.includes(habit.viz_type) ? habit.viz_type : DEFAULT_VIZ[habit.type]
}

export type RingPeriod = 'week' | 'month'
export type BarsRange = 7 | 30

/** Parameters stored in habits.viz_config. Unknown or missing values fall back to defaults. */
export type VizConfig = JarConfig & {
  ringPeriod: RingPeriod
  barsRange: BarsRange
}

export const DEFAULT_VIZ_CONFIG: VizConfig = {
  ringPeriod: 'week',
  barsRange: 7,
  jarPeriod: 'month',
  jarCapacity: 'all',
  jarMarbleValue: null,
}

const JAR_PERIODS: JarPeriod[] = ['week', 'month', 'quarter', 'year']

function readCapacity(v: Json | undefined): JarCapacity {
  if (v === 'most') return 'most'
  if (typeof v === 'number' && v >= 1) return Math.round(v)
  return 'all'
}

export function readVizConfig(raw: Json | null | undefined): VizConfig {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    ringPeriod: obj.ringPeriod === 'month' ? 'month' : 'week',
    barsRange: obj.barsRange === 30 ? 30 : 7,
    jarPeriod: JAR_PERIODS.includes(obj.jarPeriod as JarPeriod) ? (obj.jarPeriod as JarPeriod) : 'month',
    jarCapacity: readCapacity(obj.jarCapacity),
    jarMarbleValue: typeof obj.jarMarbleValue === 'number' && obj.jarMarbleValue > 0 ? obj.jarMarbleValue : null,
  }
}

/** Merges the edited parameters into the stored JSON, keeping any other keys. */
export function writeVizConfig(raw: Json | null | undefined, config: VizConfig): Json {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    ...obj,
    ringPeriod: config.ringPeriod,
    barsRange: config.barsRange,
    jarPeriod: config.jarPeriod,
    jarCapacity: config.jarCapacity,
    jarMarbleValue: config.jarMarbleValue,
  }
}
