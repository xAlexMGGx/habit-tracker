import { describe, expect, it } from 'vitest'
import es from './locales/es.json'
import en from './locales/en.json'

type Tree = { [key: string]: Tree | string | string[] }

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

function interpolations(tree: Tree, prefix = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out[`${prefix}${k}`] = [...v.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()
    else if (!Array.isArray(v)) Object.assign(out, interpolations(v, `${prefix}${k}.`))
  }
  return out
}

describe('translations', () => {
  it('es and en have the same keys', () => {
    expect(keys(en as Tree).sort()).toEqual(keys(es as Tree).sort())
  })

  it('es and en use the same {{variables}}', () => {
    expect(interpolations(en as Tree)).toEqual(interpolations(es as Tree))
  })

  it('weekday initials have 7 entries', () => {
    expect(es.weekdays.initials).toHaveLength(7)
    expect(en.weekdays.initials).toHaveLength(7)
  })
})
