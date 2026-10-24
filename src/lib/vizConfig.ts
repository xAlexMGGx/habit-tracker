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

/** 'day' (quantitative habits only): today's amount towards the daily goal. */
export type RingPeriod = 'day' | 'week' | 'month'
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

const RING_PERIODS: RingPeriod[] = ['day', 'week', 'month']
const JAR_PERIODS: JarPeriod[] = ['day', 'week', 'month', 'quarter', 'year']

function readCapacity(v: Json | undefined): JarCapacity {
  if (v === 'most') return 'most'
  if (typeof v === 'number' && v >= 1) return Math.round(v)
  return 'all'
}

export function readVizConfig(raw: Json | null | undefined): VizConfig {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    ringPeriod: RING_PERIODS.includes(obj.ringPeriod as RingPeriod) ? (obj.ringPeriod as RingPeriod) : 'week',
    barsRange: obj.barsRange === 30 ? 30 : 7,
    jarPeriod: JAR_PERIODS.includes(obj.jarPeriod as JarPeriod) ? (obj.jarPeriod as JarPeriod) : 'month',
    jarCapacity: readCapacity(obj.jarCapacity),
    jarMarbleValue: typeof obj.jarMarbleValue === 'number' && obj.jarMarbleValue > 0 ? obj.jarMarbleValue : null,
  }
}

/** Periods each type can use: the daily ones only make sense with an amount to reach. */
export function ringPeriodsFor(type: HabitType): RingPeriod[] {
  return type === 'quantitative' ? RING_PERIODS : RING_PERIODS.filter((p) => p !== 'day')
}

export function jarPeriodsFor(type: HabitType): JarPeriod[] {
  return type === 'quantitative' ? JAR_PERIODS : JAR_PERIODS.filter((p) => p !== 'day')
}

/** The config as a habit of this type can use it (a daily period falls back to the default). */
export function configFor(type: HabitType, config: VizConfig): VizConfig {
  return {
    ...config,
    ringPeriod: ringPeriodsFor(type).includes(config.ringPeriod) ? config.ringPeriod : DEFAULT_VIZ_CONFIG.ringPeriod,
    jarPeriod: jarPeriodsFor(type).includes(config.jarPeriod) ? config.jarPeriod : DEFAULT_VIZ_CONFIG.jarPeriod,
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
