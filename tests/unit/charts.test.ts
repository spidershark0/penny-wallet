import { describe, it, expect } from 'vitest'
import { filterPieData, formatK } from '../../src/view/charts'

describe('formatK', () => {
  it('formats values >= 10000 as Nk', () => {
    expect(formatK(50000)).toBe('50k')
    expect(formatK(97000)).toBe('97k')
    expect(formatK(10000)).toBe('10k')
  })

  it('formats negative values >= 10000 abs as -Nk', () => {
    expect(formatK(-50000)).toBe('-50k')
  })

  it('formats values < 10000 with locale string (abs)', () => {
    expect(formatK(9999)).toBe('9,999')
    expect(formatK(1500)).toBe('1,500')
  })

  it('respects dp=2 for < 10000', () => {
    expect(formatK(1500, 2)).toBe('1,500.00')
  })
})

describe('filterPieData', () => {
  it('keeps segments >= 1%', () => {
    const data = new Map([['food', 90], ['transport', 10]])
    const result = filterPieData(data)
    expect(result.get('food')).toBe(90)
    expect(result.get('transport')).toBe(10)
    expect(result.has('__other__')).toBe(false)
  })

  it('merges segments < 1% into __other__', () => {
    // total=1000: food=990 (99%), misc=5 (0.5%), fees=5 (0.5%)
    const data = new Map([['food', 990], ['misc', 5], ['fees', 5]])
    const result = filterPieData(data)
    expect(result.get('food')).toBe(990)
    expect(result.has('misc')).toBe(false)
    expect(result.has('fees')).toBe(false)
    expect(result.get('__other__')).toBe(10)
  })

  it('keeps uncategorized ("") if >= 1%', () => {
    const data = new Map([['food', 80], ['', 20]])
    const result = filterPieData(data)
    expect(result.get('')).toBe(20)
    expect(result.has('__other__')).toBe(false)
  })

  it('merges uncategorized ("") into __other__ if < 1%', () => {
    // total=1000: food=999 (99.9%), ''=1 (0.1%)
    const data = new Map([['food', 999], ['', 1]])
    const result = filterPieData(data)
    expect(result.has('')).toBe(false)
    expect(result.get('__other__')).toBe(1)
  })

  it('returns empty map for empty input', () => {
    const result = filterPieData(new Map())
    expect(result.size).toBe(0)
  })

  it('appends __other__ as last key', () => {
    // total=1000: food=900 (90%), tiny=9 (0.9%), transport=91 (9.1%)
    const data = new Map([['food', 900], ['tiny', 9], ['transport', 91]])
    const result = filterPieData(data)
    const keys = [...result.keys()]
    expect(keys[keys.length - 1]).toBe('__other__')
    expect(result.get('__other__')).toBe(9)
  })

  it('returns empty map when all values are zero', () => {
    const data = new Map([['food', 0], ['transport', 0]])
    const result = filterPieData(data)
    expect(result.size).toBe(0)
  })
})
