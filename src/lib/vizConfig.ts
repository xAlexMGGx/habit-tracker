import type { Habit, HabitType, Json, VizType } from './database.types'
import { DEFAULT_VIZ, VIZ_BY_TYPE } from './habitMeta'

/** Visualizations that have a component. The marble jar and the plant arrive in phase 3. */
export const IMPLEMENTED_VIZ: VizType[] = ['heatmap', 'calendar', 'ring', 'bars', 'days_since']

/** Compatible visualizations that can be shown today, in the SPEC's order. */
export function availableViz(type: HabitType): VizType[] {
  return VIZ_BY_TYPE[type].filter((v) => IMPLEMENTED_VIZ.includes(v))
}

/** The habit's chosen visualization, or its type's default if that one isn't available yet. */
export function effectiveViz(habit: Pick<Habit, 'type' | 'viz_type'>): VizType {
  return IMPLEMENTED_VIZ.includes(habit.viz_type) ? habit.viz_type : DEFAULT_VIZ[habit.type]
}

export type RingPeriod = 'week' | 'month'
export type BarsRange = 7 | 30

/** Parameters stored in habits.viz_config. Unknown or missing values fall back to defaults. */
export type VizConfig = {
  ringPeriod: RingPeriod
  barsRange: BarsRange
}

export const DEFAULT_VIZ_CONFIG: VizConfig = { ringPeriod: 'week', barsRange: 7 }

export function readVizConfig(raw: Json | null | undefined): VizConfig {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    ringPeriod: obj.ringPeriod === 'month' ? 'month' : 'week',
    barsRange: obj.barsRange === 30 ? 30 : 7,
  }
}

/** Merges the edited parameters into the stored JSON, keeping keys used by other visualizations. */
export function writeVizConfig(raw: Json | null | undefined, config: VizConfig): Json {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return { ...obj, ringPeriod: config.ringPeriod, barsRange: config.barsRange }
}
