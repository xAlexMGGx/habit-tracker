import { type Locale, format, getISOWeek } from 'date-fns'
import type { TFunction } from 'i18next'
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateLocale } from '../../i18n'
import { type DateStr, fromDateStr } from '../../lib/dates'
import { capitalize } from '../../lib/format'
import { formatNumber, formatPercent } from '../../lib/habitMeta'
import { type Jar, type JarPeriod, currentJar, marbleValue, periodStart, shelfJars, shiftPeriod } from '../../lib/jar'
import type { VizProps } from './types'
import s from './viz.module.css'

// Jar drawing, in a 100 × 132 box.
const BODY = 'M27 24 H73 V30 C86 32 90 40 90 50 V112 C90 122 83 128 73 128 H27 C17 128 10 122 10 112 V50 C10 40 14 32 27 30 Z'
const INNER = { left: 13, right: 87, top: 40, bottom: 125 }
const HEIGHT = { compact: 112, regular: 150, full: 210 }

/** Hexagonal packing from the bottom up; each row fills from the middle out, like marbles settling. */
function packing(r: number): [number, number][] {
  const width = INNER.right - INNER.left
  const center = (INNER.left + INNER.right) / 2
  const out: [number, number][] = []
  for (let row = 0; ; row++) {
    const y = INNER.bottom - r - row * r * Math.sqrt(3)
    if (y - r < INNER.top) break
    const offset = row % 2 ? r : 0
    const n = Math.floor((width - offset) / (2 * r))
    const x0 = INNER.left + offset + (width - offset - n * 2 * r) / 2 + r
    const rowPos: [number, number][] = Array.from({ length: n }, (_, i) => [x0 + i * 2 * r, y])
    rowPos.sort((a, b) => Math.abs(a[0] - center) - Math.abs(b[0] - center))
    out.push(...rowPos)
  }
  return out
}

/** Biggest marble radius that fits `capacity` marbles in the jar. */
function layoutFor(capacity: number): { r: number; positions: [number, number][] } {
  let lo = 0.6
  let hi = 20
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (packing(mid).length >= capacity) lo = mid
    else hi = mid
  }
  return { r: lo, positions: packing(lo) }
}

const SHADES = [s.m0, s.m1, s.m2, s.m3]

export function periodLabel(start: DateStr, period: JarPeriod, t: TFunction, locale: Locale, long: boolean): string {
  const d = fromDateStr(start)
  switch (period) {
    case 'week':
      return long
        ? t('viz.jar.weekOf', { date: format(d, t('formats.dayMonth'), { locale }) })
        : t('viz.jar.weekShort', { n: getISOWeek(d) })
    case 'month':
      return long ? capitalize(format(d, 'LLLL yyyy', { locale })) : format(d, 'LLL', { locale })
    case 'quarter': {
      const n = Math.floor(d.getMonth() / 3) + 1
      return long
        ? t('viz.jar.quarter', { n, year: d.getFullYear() })
        : t('viz.jar.quarterShort', { n, yy: String(d.getFullYear()).slice(2) })
    }
    case 'year':
      return String(d.getFullYear())
  }
}

function JarSvg({ jar, height, title }: { jar: Jar; height: number; title: string }) {
  const clip = `jar${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const { r, positions } = useMemo(() => layoutFor(jar.capacity), [jar.capacity])
  const shown = Math.min(jar.count, jar.capacity, positions.length)
  const gloss = r >= 2.5

  return (
    <svg width={(height * 100) / 132} height={height} viewBox="0 0 100 132" role="img" aria-label={title}>
      <defs>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d={BODY} className={s.jarGlass} />
      <g clipPath={`url(#${clip})`}>
        {positions.slice(0, shown).map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 0.94} className={SHADES[(i * 7 + (i >> 2)) % SHADES.length]} />
            {gloss ? <circle cx={x - r * 0.32} cy={y - r * 0.32} r={r * 0.28} className={s.marbleGloss} /> : null}
          </g>
        ))}
      </g>
      <path d={BODY} className={s.jarOutline} />
      <path d="M18 54 V108" className={s.jarShine} />
      <rect x="22" y="10" width="56" height="15" rx="4" className={s.jarLid} />
      <rect x="22" y="16" width="56" height="3" className={s.jarLidBand} />
      {jar.extra > 0 ? (
        <g>
          <rect x="54" y="0" width="44" height="22" rx="11" className={s.jarExtraBg} />
          <text x="76" y="15.5" textAnchor="middle" className={s.jarExtraText}>
            +{jar.extra}
          </text>
        </g>
      ) : null}
    </svg>
  )
}

const MINI_BODY = 'M11 9 H29 V12 C35 13 37 16 37 20 V44 C37 48 34 50 30 50 H10 C6 50 3 48 3 44 V20 C3 16 5 13 11 12 Z'

function MiniJar({ jar, label }: { jar: Jar | null; label: string }) {
  const clip = `mini${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const level = jar ? Math.min(1, jar.count / jar.capacity) : 0
  const top = 50 - level * 38
  return (
    <div className={`${s.shelfItem} ${jar ? '' : s.shelfEmpty}`}>
      <svg viewBox="0 0 40 52" className={s.miniJar} aria-hidden>
        <defs>
          <clipPath id={clip}>
            <path d={MINI_BODY} />
          </clipPath>
        </defs>
        <path d={MINI_BODY} className={jar ? s.jarGlass : s.miniEmpty} />
        {jar ? <rect x="0" y={top} width="40" height={52 - top} clipPath={`url(#${clip})`} className={s.miniFill} /> : null}
        <path d={MINI_BODY} className={jar ? s.jarOutline : s.miniEmpty} />
        <rect x="9" y="4" width="22" height="6" rx="2" className={jar ? s.jarLid : s.miniEmpty} />
        {jar && jar.extra > 0 ? <circle cx="34" cy="6" r="5" className={s.jarExtraBg} /> : null}
      </svg>
      <span className={s.shelfLabel}>{label}</span>
      {jar ? <span className={s.shelfCount}>{jar.count}</span> : null}
    </div>
  )
}

/**
 * Marble jar: every completion adds a marble (quantitative: one per `marble value`, accumulated).
 * Missing never removes marbles. When the period ends the jar goes to the shelf (detail view).
 */
export function MarbleJar({ habit, logs, today, size, config }: VizProps) {
  const { t, i18n } = useTranslation()
  const locale = useDateLocale()
  const jar = currentJar(habit, config, logs, today)
  const period = periodLabel(jar.start, config.jarPeriod, t, locale, true)
  const quantitative = habit.type === 'quantitative'

  return (
    <div className={`${s.jar} ${s[`jar_${size}`]}`}>
      <JarSvg jar={jar} height={HEIGHT[size]} title={`${t('habits.viz.marble_jar')}: ${jar.count}/${jar.capacity}`} />
      <div className={s.jarCaption}>
        <span className={s.jarCount}>
          {Math.min(jar.count, jar.capacity)}
          <span className={s.muted}> / {jar.capacity}</span>
        </span>
        <span className={s.jarPeriod}>{period}</span>
        {jar.extra > 0 && size !== 'compact' ? <span className={s.jarExtraNote}>{t('viz.jar.extra', { count: jar.extra })}</span> : null}
      </div>

      {size === 'full' ? (
        <>
          {quantitative ? (
            <p className={s.jarInfo}>
              {t('viz.jar.marbleValue', { value: formatNumber(marbleValue(habit, config), i18n.language), unit: habit.unit ?? '' }).trim()}
              {jar.fraction > 0
                ? ` · ${t('viz.jar.nextMarble', { pct: formatPercent(jar.fraction, i18n.language) })}`
                : ''}
            </p>
          ) : null}
          <Shelf jars={shelfJars(habit, config, logs, today)} period={config.jarPeriod} today={today} />
        </>
      ) : null}
    </div>
  )
}

/** 4 × 3 grid with the last 12 finished jars, oldest first (a full year with monthly jars). */
function Shelf({ jars, period, today }: { jars: (Jar | null)[]; period: JarPeriod; today: DateStr }) {
  const { t } = useTranslation()
  const locale = useDateLocale()
  const current = periodStart(today, period)
  return (
    <div className={s.shelf}>
      <h4 className={s.shelfTitle}>{t('viz.jar.shelf')}</h4>
      <div className={s.shelfGrid}>
        {jars.map((jar, i) => {
          const start = shiftPeriod(current, period, i - jars.length)
          return <MiniJar key={start} jar={jar} label={periodLabel(start, period, t, locale, false)} />
        })}
      </div>
    </div>
  )
}
