import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { usePresence } from '../../components/usePresence'
import { useToday } from '../../hooks/useToday'
import type { VizType } from '../../lib/database.types'
import { HABIT_TYPES, VIZ_BY_TYPE } from '../../lib/habitMeta'
import { GUIDE_SAMPLES, sampleHabit, sampleLogs } from '../../lib/sampleData'
import { DEFAULT_VIZ_CONFIG, IMPLEMENTED_VIZ } from '../../lib/vizConfig'
import { HabitViz } from './HabitViz'
import s from './VizGuide.module.css'

type GuideViz = keyof typeof GUIDE_SAMPLES
const PAGES = IMPLEMENTED_VIZ as GuideViz[]

function GuidePage({ viz }: { viz: GuideViz }) {
  const { t } = useTranslation()
  const today = useToday()
  const habit = useMemo(
    () => sampleHabit(today, { ...GUIDE_SAMPLES[viz], name: t(`guide.${viz}.example`) }),
    [today, viz, t],
  )
  const logs = useMemo(() => sampleLogs(habit, today, viz.length * 31), [habit, today, viz])
  const types = HABIT_TYPES.filter((type) => VIZ_BY_TYPE[type].includes(viz))

  return (
    <section className={s.page} aria-roledescription="slide">
      <h2 className={s.vizName}>{t(`habits.viz.${viz}`)}</h2>
      <div className={s.example}>
        <div className={s.exampleHead}>
          <span className={s.exampleIcon}>{habit.icon}</span>
          <span className={s.exampleName}>{habit.name}</span>
        </div>
        <HabitViz habit={habit} logs={logs} today={today} size="regular" config={DEFAULT_VIZ_CONFIG} viz={viz} />
      </div>
      <h3 className={s.heading}>{t('guide.howToRead')}</h3>
      <p className={s.text}>{t(`guide.${viz}.read`)}</p>
      <h3 className={s.heading}>{t('guide.purpose')}</h3>
      <p className={s.text}>{t(`guide.${viz}.purpose`)}</p>
      <h3 className={s.heading}>{t('guide.idealFor')}</h3>
      <div className={s.types}>
        {types.map((type) => (
          <span key={type} className={s.typeBadge}>
            {t(`habits.types.${type}`)}
          </span>
        ))}
      </div>
      <p className={s.text}>{t(`guide.${viz}.ideal`)}</p>
    </section>
  )
}

type Props = {
  open: boolean
  /** Contextual: opens on the visualization being chosen (SPEC §8). */
  initial?: VizType
  onClose: () => void
}

/** "?" guide: one swipeable page per visualization. */
export function VizGuide({ open, initial, onClose }: Props) {
  const { t } = useTranslation()
  const { mounted, visible } = usePresence(open)
  const track = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  useLayoutEffect(() => {
    if (!mounted || !track.current) return
    const start = Math.max(0, PAGES.indexOf(initial as GuideViz))
    track.current.scrollLeft = start * track.current.clientWidth
    setPage(start)
  }, [mounted, initial])

  const goTo = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  if (!mounted) return null

  return createPortal(
    <div className={`${s.root} ${visible ? s.visible : ''}`} role="dialog" aria-modal="true" aria-label={t('guide.title')}>
      <header className={s.header}>
        <h1 className={s.title}>{t('guide.title')}</h1>
        <button type="button" className={s.close} onClick={onClose} aria-label={t('common.close')}>
          <X size={22} />
        </button>
      </header>
      <div
        ref={track}
        className={s.track}
        onScroll={(e) => {
          const el = e.currentTarget
          setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
        }}
      >
        {PAGES.map((viz) => (
          <GuidePage key={viz} viz={viz} />
        ))}
      </div>
      <footer className={s.footer}>
        <button type="button" className={s.arrow} disabled={page === 0} onClick={() => goTo(page - 1)} aria-label={t('guide.previous')}>
          <ChevronLeft size={22} />
        </button>
        <div className={s.dots}>
          {PAGES.map((viz, i) => (
            <button
              key={viz}
              type="button"
              className={`${s.dot} ${i === page ? s.dotOn : ''}`}
              aria-label={t(`habits.viz.${viz}`)}
              aria-current={i === page}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className={s.arrow}
          disabled={page === PAGES.length - 1}
          onClick={() => goTo(page + 1)}
          aria-label={t('guide.next')}
        >
          <ChevronRight size={22} />
        </button>
      </footer>
    </div>,
    document.body,
  )
}
