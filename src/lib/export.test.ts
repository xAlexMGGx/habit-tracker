import { describe, expect, it } from 'vitest'
import { toCsv } from './export'

describe('toCsv', () => {
  it('escapes quotes, commas, newlines and joins arrays', () => {
    const csv = toCsv(
      [{ a: 'plain', b: 'with, comma', c: 'say "hi"', d: [1, 3, 5], e: null }],
      ['a', 'b', 'c', 'd', 'e'],
    )
    expect(csv).toBe('﻿a,b,c,d,e\r\nplain,"with, comma","say ""hi""",1|3|5,\r\n')
  })
})
