export const TILE = {
  EMPTY: "empty", FILLED: "filled", CORRECT: "correct", PRESENT: "present", ABSENT: "absent",
}

export const GREEN_POINTS = 10
// Indexed by number of guesses to solve (1–6). Index 0 = unused.
export const WIN_BONUS = [0, 100, 80, 60, 40, 20, 10]

export function computeGreenScore(guesses) {
  let greens = 0
  guesses.forEach(({ states }) => {
    states.forEach(s => { if (s === TILE.CORRECT) greens++ })
  })
  return greens * GREEN_POINTS
}

export function computeBonus(won, guessCount) {
  return won ? (WIN_BONUS[guessCount] || 0) : 0
}

export function evaluateGuess(guess, target) {
  const result = Array(5).fill(TILE.ABSENT)
  const targetArr = target.split("")
  const guessArr = guess.split("")
  const used = Array(5).fill(false)
  guessArr.forEach((l, i) => {
    if (l === targetArr[i]) { result[i] = TILE.CORRECT; used[i] = true }
  })
  guessArr.forEach((l, i) => {
    if (result[i] === TILE.CORRECT) return
    const j = targetArr.findIndex((t, idx) => t === l && !used[idx])
    if (j !== -1) { result[i] = TILE.PRESENT; used[j] = true }
  })
  return result
}
