import { describe, it, expect } from 'vitest'
import { computeGreenScore, computeBonus, WIN_BONUS, GREEN_POINTS, TILE } from '../lib/gameLogic'

const { CORRECT, PRESENT, ABSENT } = TILE

describe('computeGreenScore', () => {
  it('returns 0 for no guesses', () => {
    expect(computeGreenScore([])).toBe(0)
  })

  it('scores GREEN_POINTS per correct tile', () => {
    const guesses = [{ states: [CORRECT, ABSENT, CORRECT, ABSENT, ABSENT] }]
    expect(computeGreenScore(guesses)).toBe(2 * GREEN_POINTS)
  })

  it('sums across multiple rows', () => {
    const guesses = [
      { states: [CORRECT, CORRECT, ABSENT, ABSENT, ABSENT] },  // 2
      { states: [ABSENT, CORRECT, CORRECT, ABSENT, CORRECT] }, // 3
    ]
    expect(computeGreenScore(guesses)).toBe(5 * GREEN_POINTS)
  })

  it('present tiles do not score', () => {
    const guesses = [{ states: [PRESENT, PRESENT, PRESENT, PRESENT, PRESENT] }]
    expect(computeGreenScore(guesses)).toBe(0)
  })

  it('all-correct row scores 5 × GREEN_POINTS', () => {
    const guesses = [{ states: [CORRECT, CORRECT, CORRECT, CORRECT, CORRECT] }]
    expect(computeGreenScore(guesses)).toBe(5 * GREEN_POINTS)
  })
})

describe('computeBonus', () => {
  it('returns 0 when not won', () => {
    expect(computeBonus(false, 1)).toBe(0)
    expect(computeBonus(false, 6)).toBe(0)
  })

  it('returns 0 for 0-guess count (edge)', () => {
    expect(computeBonus(true, 0)).toBe(0)
  })

  it('returns maximum bonus of 100 for 1-guess solve', () => {
    expect(computeBonus(true, 1)).toBe(100)
  })

  it('returns minimum bonus of 10 for 6-guess solve', () => {
    expect(computeBonus(true, 6)).toBe(10)
  })

  it('matches WIN_BONUS table for every valid solve count', () => {
    for (let i = 1; i <= 6; i++) {
      expect(computeBonus(true, i)).toBe(WIN_BONUS[i])
    }
  })

  it('decreases as guess count increases', () => {
    for (let i = 1; i < 6; i++) {
      expect(computeBonus(true, i)).toBeGreaterThan(computeBonus(true, i + 1))
    }
  })

  it('returns 0 for out-of-range guess count', () => {
    expect(computeBonus(true, 7)).toBe(0)
    expect(computeBonus(true, 99)).toBe(0)
  })
})
