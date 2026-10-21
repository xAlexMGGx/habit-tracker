import { useTranslation } from 'react-i18next'
import { PLANT_PHASES, PLANT_WINDOW, type PlantPhase, plantState } from '../../lib/plant'
import type { VizProps } from './types'
import s from './viz.module.css'

const HEIGHT = { compact: 112, regular: 150, full: 210 }
const BASE = { x: 60, y: 99 }

/** Leaves along the stem: [position 0..1 from the soil, side, size]. */
const LEAVES: Record<Exclude<PlantPhase, 'seed'>, [number, -1 | 1, number][]> = {
  sprout: [
    [1, -1, 0.55],
    [1, 1, 0.55],
  ],
  young: [
    [0.45, -1, 0.7],
    [0.65, 1, 0.75],
    [0.88, -1, 0.6],
    [1, 1, 0.5],
  ],
  plant: [
    [0.28, -1, 0.85],
    [0.42, 1, 0.9],
    [0.56, -1, 0.9],
    [0.7, 1, 0.85],
    [0.84, -1, 0.7],
    [0.97, 1, 0.55],
  ],
  flower: [
    [0.28, -1, 0.85],
    [0.42, 1, 0.9],
    [0.56, -1, 0.9],
    [0.7, 1, 0.85],
    [0.84, -1, 0.65],
  ],
}

const STEM_TOP: Record<Exclude<PlantPhase, 'seed'>, number> = { sprout: 80, young: 62, plant: 44, flower: 38 }

const LEAF = 'M0 0 C5 -7 17 -9 26 -2 C17 6 6 6 0 0 Z'
const VEIN = 'M2 -0.5 Q13 -2.5 23 -2'

function PlantSvg({ phase, wilted, height, label }: { phase: PlantPhase; wilted: boolean; height: number; label: string }) {
  let plant = null
  if (phase === 'seed') {
    plant = (
      <g>
        <ellipse cx={60} cy={96} rx={7} ry={5} className={wilted ? s.seedDry : s.seed} />
        <ellipse cx={57.5} cy={94} rx={2.2} ry={1.4} className={s.seedShine} />
      </g>
    )
  } else {
    // Wilted: the stem bends over and the leaves droop. It never dies.
    const top = STEM_TOP[phase] + (wilted ? 10 : 0)
    const xTop = BASE.x + (wilted ? 16 : 1.5)
    const mid = (BASE.y + top) / 2
    const at = (t: number) => ({ x: BASE.x + t * t * (xTop - BASE.x), y: BASE.y + t * (top - BASE.y) })
    const leafClass = wilted ? s.leafDry : s.leaf
    const veinClass = wilted ? s.veinDry : s.vein
    plant = (
      <g className={wilted ? undefined : s.sway}>
        <path d={`M${BASE.x} ${BASE.y} Q${BASE.x} ${mid} ${xTop} ${top}`} className={wilted ? s.stemDry : s.stem} />
        {LEAVES[phase].map(([t, side, size], i) => {
          const p = at(t)
          const angle = wilted ? 38 : -28
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) scale(${side} 1) rotate(${angle}) scale(${size})`}>
              <path d={LEAF} className={leafClass} />
              <path d={VEIN} className={veinClass} />
            </g>
          )
        })}
        {phase === 'flower' ? (
          <g transform={`translate(${xTop} ${top}) rotate(${wilted ? 50 : 0})`}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx={0} cy={-8} rx={5} ry={8.5} transform={`rotate(${a})`} className={wilted ? s.petalDry : s.petal} />
            ))}
            <circle r={5} className={s.flowerCenter} />
          </g>
        ) : null}
      </g>
    )
  }

  return (
    <svg width={(height * 120) / 140} height={height} viewBox="0 0 120 140" role="img" aria-label={label}>
      <ellipse cx={60} cy={137} rx={34} ry={2.5} className={s.potShadow} />
      <path d="M33 109 L87 109 L81.5 134 Q81 136 78.5 136 L41.5 136 Q39 136 38.5 134 Z" className={s.potBody} />
      <rect x={28} y={98} width={64} height={12} rx={3} className={s.potRim} />
      <ellipse cx={60} cy={99.5} rx={28} ry={3.5} className={s.soil} />
      {plant}
      {phase === 'flower' && !wilted ? (
        <g className={s.sparkles}>
          <path d="M26 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" />
          <path d="M92 50 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 Z" />
          <path d="M84 18 l1.2 2.8 l2.8 1.2 l-2.8 1.2 l-1.2 2.8 l-1.2 -2.8 l-2.8 -1.2 l2.8 -1.2 Z" />
        </g>
      ) : null}
    </svg>
  )
}

/**
 * Plant: recent consistency. The phase comes from the completion over the last 14 due days;
 * three misses in a row make it wilt, and one completion revives it.
 */
export function Plant({ habit, logs, today, size }: VizProps) {
  const { t } = useTranslation()
  const st = plantState(habit, logs, today)
  const phaseName = t(`viz.plant.phases.${st.phase}`)

  return (
    <div className={`${s.plant} ${s[`plant_${size}`]}`}>
      <PlantSvg
        phase={st.phase}
        wilted={st.wilted}
        height={HEIGHT[size]}
        label={`${t('habits.viz.plant')}: ${phaseName}${st.wilted ? `, ${t('viz.plant.wiltedShort')}` : ''}`}
      />
      <div className={s.plantCaption}>
        <span className={s.plantPhase}>
          {phaseName}
          {st.wilted ? <span className={s.plantWilted}> · {t('viz.plant.wiltedShort')}</span> : null}
        </span>
        <span className={s.muted}>{t('viz.plant.window', { done: st.done, days: PLANT_WINDOW })}</span>
        {st.wilted && size !== 'compact' ? <span className={s.plantHint}>{t('viz.plant.wiltedHint')}</span> : null}
      </div>

      {size === 'full' ? (
        <div className={s.plantSteps}>
          <div className={s.plantStepRow}>
            {PLANT_PHASES.map((p, i) => (
              <span key={p} className={`${s.plantStep} ${i <= st.phaseIndex ? s.plantStepOn : ''}`}>
                <span className={s.plantStepDot} />
                {t(`viz.plant.phases.${p}`)}
              </span>
            ))}
          </div>
          <p className={s.plantNext}>
            {st.nextDays == null
              ? t('viz.plant.bloom')
              : t('viz.plant.next', {
                  phase: t(`viz.plant.phases.${PLANT_PHASES[st.phaseIndex + 1]}`),
                  needed: st.nextDays,
                  days: PLANT_WINDOW,
                })}
          </p>
        </div>
      ) : null}
    </div>
  )
}
