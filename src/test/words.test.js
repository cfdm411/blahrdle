import { describe, it, expect } from 'vitest'
import { WORDS, ANSWERS, VALID_WORDS } from '../data/words'

describe('WORDS', () => {
  it('is non-empty', () => {
    expect(WORDS.length).toBeGreaterThan(0)
  })

  it('every word is exactly 5 letters', () => {
    WORDS.forEach(w => expect(w).toHaveLength(5))
  })

  it('every word is uppercase', () => {
    WORDS.forEach(w => expect(w).toBe(w.toUpperCase()))
  })

  it('contains no empty strings', () => {
    WORDS.forEach(w => expect(w.trim().length).toBeGreaterThan(0))
  })
})

describe('ANSWERS', () => {
  it('every answer is in VALID_WORDS', () => {
    ANSWERS.forEach(w => expect(VALID_WORDS.has(w)).toBe(true))
  })

  it('has the same unique words as WORDS', () => {
    expect(new Set(ANSWERS).size).toBe(new Set(WORDS).size)
  })
})

describe('VALID_WORDS', () => {
  it('is a Set', () => {
    expect(VALID_WORDS).toBeInstanceOf(Set)
  })

  it('contains every word from WORDS', () => {
    WORDS.forEach(w => expect(VALID_WORDS.has(w)).toBe(true))
  })

  it('does not contain words shorter or longer than 5 letters', () => {
    VALID_WORDS.forEach(w => expect(w).toHaveLength(5))
  })
})
