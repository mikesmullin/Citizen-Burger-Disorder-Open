import { C } from '../common/ecs.js'
import { ITEM_NAMES } from '../gamedata/menu.js'

export function npcInQueue(world) {
  for (const [eid, cust, think] of world.query(C.Customer, C.Thinker)) {
    if (think.want === 'order' && cust.leader === eid) return eid
  }
  return 0
}

export function waitingForStand(world) {
  for (const [eid, cust, think] of world.query(C.Customer, C.Thinker)) {
    if (think.want === 'getStand' && cust.leader === eid) return eid
  }
  return 0
}

export function generateWants(world, leaderEid) {
  const leader = world.field(leaderEid, C.Customer)
  if (!leader) return
  for (const [, cust, speech] of world.query(C.Customer, C.Speech)) {
    if (cust.groupId !== leader.groupId) continue
    if (!cust.desiredFood) {
      cust.desiredFood = ITEM_NAMES[(Math.random() * ITEM_NAMES.length) | 0]
    }
    if (speech) {
      speech.icon = cust.desiredFood
      speech.nearOnly = false
    }
  }
}

function pickFreeTable(world, size) {
  const tables = [...world.query(C.Table)]
  const exact = tables.filter(([, t]) => t.capacity === size)
  const bigger = tables.filter(([, t]) => t.capacity > size)
  for (const [, t] of [...exact, ...bigger]) {
    let used = 0
    for (const [, seat] of world.query(C.Seat)) {
      if (seat.tableId === t.tableId && seat.occupiedBy) used++
    }
    if (used === 0) return t.tableId
  }
  return 0
}

function groupSizeOf(world, leader) {
  let n = 0
  for (const [, c] of world.query(C.Customer)) if (c.groupId === leader.groupId) n++
  return n
}

function groupFoods(world, leader) {
  const items = []
  for (const [, c] of world.query(C.Customer)) {
    if (c.groupId === leader.groupId && c.desiredFood) items.push(c.desiredFood)
  }
  return items.slice(0, 4)
}

export function confirm(world, items) {
  const leaderEid = npcInQueue(world)
  if (!leaderEid) return { error: 'noQueue' }
  const leader = world.field(leaderEid, C.Customer)
  const think = world.field(leaderEid, C.Thinker)
  const speech = world.field(leaderEid, C.Speech)
  generateWants(world, leaderEid)
  const filled = (items || []).filter(Boolean).slice(0, 4)
  if (filled.length) {
    let i = 0
    for (const [, cust, sp] of world.query(C.Customer, C.Speech)) {
      if (cust.groupId !== leader.groupId) continue
      if (filled[i]) {
        cust.desiredFood = filled[i]
        if (sp) sp.icon = filled[i]
        i++
      }
    }
  }
  const tableId = pickFreeTable(world, groupSizeOf(world, leader))
  if (!tableId) return { error: 'noTable' }
  const ticket = filled.length ? filled : groupFoods(world, leader)
  for (const [, cust] of world.query(C.Customer)) {
    if (cust.groupId === leader.groupId) cust.tableId = tableId
  }
  const comps = new Map()
  comps.set(C.Order, { tableId, items: ticket, status: 'hanging', leaderEid })
  const orderEid = world.spawn(C.Order, comps, 'front/Order')
  think.prevWant = think.want
  think.want = 'getStand'
  if (speech) speech.icon = 'NumberStand'
  world.emit('OrderConfirmed', { orderEid, tableId, leaderEid, items: ticket })
  return { orderEid, tableId, leaderEid, items: ticket }
}

export function update(world) {
  for (const [eid, cust, think] of world.query(C.Customer, C.Thinker)) {
    if (think.want === 'order' && cust.leader === eid && !cust.desiredFood) {
      generateWants(world, eid)
    }
  }
}
