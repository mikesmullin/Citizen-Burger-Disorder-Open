// Literal port of Menu.cs ScoreFood (the serve path). CompareAgainstFood skipped.

export const ITEMS = {
  Citizen:   ['patty', 'cheese', 'lettuce', 'topBun'],
  Family:    ['patty', 'cheese', 'bun', 'patty', 'cheese', 'lettuce', 'topBun'],
  Worker:    ['patty', 'cheese', 'patty', 'cheese', 'topBun'],
  President: ['cheese', 'patty', 'lettuce', 'tomato', 'tomato', 'topBun'],
  Mayor:     ['patty', 'lettuce', 'tomato', 'tomato', 'bacon', 'bacon', 'topBun'],
  Boss:      ['patty', 'cheese', 'patty', 'bacon', 'bacon', 'topBun'],
}
export const ITEM_NAMES = Object.keys(ITEMS)

function pts(type) {
  if (type === 'patty') return 2
  if (type === 'bacon' || type === 'tomato') return 0.5
  return 1
}

function cookMul(f) {
  const cooked = f.cooked ?? 0
  const over = f.overcooked ?? 0
  if (f.type === 'patty' || f.type === 'bacon') {
    let s = 1
    if (cooked < 0.8) s *= cooked
    return s * (1 - over)
  }
  return (1 - cooked) * (1 - over)
}

// food.stack is bottom→top Food items, excluding the bottom bun itself.
export function scoreFood(foodItem, food) {
  const recipe = (ITEMS[foodItem] || ITEMS.Citizen).filter(t => t !== 'topBun')
  const goal = recipe.slice()
  const extras = []
  let score = 0
  for (const f of (food.stack || []).slice().reverse()) {
    const j = goal.findIndex(t => t === f.type)
    if (j >= 0) {
      goal[j] = null
      score += pts(f.type) * cookMul(f)
    } else if (f.type !== 'topBun') {
      extras.push(f)
    }
  }
  score -= extras.length
  return Math.round(score)
}

export function tipCount(score) {
  let n = Math.round(score * 1.3 * 0.5)
  if (Math.random() > 0.8) n += 1
  return Math.max(0, n)
}
