import { describe, it, expect } from 'vitest'
import { evaluateGuess, TILE } from '../lib/gameLogic'

const { CORRECT, PRESENT, ABSENT } = TILE

describe('evaluateGuess', () => {
  it('marks all correct when guess equals target', () => {
    expect(evaluateGuess('CRANE', 'CRANE')).toEqual([CORRECT, CORRECT, CORRECT, CORRECT, CORRECT])
  })

  it('marks all absent when no letters match', () => {
    expect(evaluateGuess('JUMPY', 'CRANE')).toEqual([ABSENT, ABSENT, ABSENT, ABSENT, ABSENT])
  })

  it('marks present when letter is in target but wrong position', () => {
    const result = evaluateGuess('ACORN', 'CRANE')
    expect(result[0]).toBe(PRESENT) // A is in CRANE
    expect(result[1]).toBe(PRESENT) // C is in CRANE
  })

  it('does not double-count duplicate letters', () => {
    // BOBBY vs ABBEY: ABBEY has two B's, BOBBY has three — only two should be marked
    const result = evaluateGuess('BOBBY', 'ABBEY')
    // B at index 2 is correct (matches ABBEY[2])
    expect(result[2]).toBe(CORRECT)
    // B at index 0 is present (one remaining B in ABBEY)
    expect(result[0]).toBe(PRESENT)
    // B at index 3 is absent (both B's in ABBEY already claimed)
    expect(result[3]).toBe(ABSENT)
  })

  it('prefers correct over present for same letter', () => {
    // CRACK vs CRANE: C at index 0 is correct; the extra C at index 3 should be absent
    const result = evaluateGuess('CRACK', 'CRANE')
    expect(result[0]).toBe(CORRECT) // C matches CRANE[0]
    expect(result[3]).toBe(ABSENT)  // no remaining C in target
  })

  it('returns an array of length 5', () => {
    expect(evaluateGuess('TRACE', 'CRANE')).toHaveLength(5)
  })
})
