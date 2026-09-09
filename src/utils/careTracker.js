// Shared store for self-care habits (e.g. hair wash, waxing) that can be logged either by
// checking them off in the to-do list or by adding a date directly on the calendar.
// Also syncs in the background to the server so the same account sees the same data on any device.
import { pullUserData, pushUserData } from './syncedStore'

const CARE_TRACKER_STORAGE_KEY = 'memoirCareTracker'
const CARE_ITEMS_STORAGE_KEY = 'memoirCareItems'
const CARE_TRACKER_EVENT = 'memoir-care-tracker-updated'

const DEFAULT_CARE_ITEMS = [
  { id: 'hairwash', label: 'Hair wash', keywords: ['hairwash', 'hair wash'], color: '#ec4899' },
  { id: 'waxing', label: 'Waxing', keywords: ['waxing', 'wax'], color: '#d97706' },
]

// Cycled through as new habits are added so each gets a distinct calendar dot color.
const CARE_COLORS = ['#ec4899', '#d97706', '#0891b2', '#7c3aed', '#16a34a', '#dc2626', '#2563eb', '#ca8a04']

function slugify(label) {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || `habit-${Date.now()}`
}

export function loadCareItems() {
  try {
    const raw = localStorage.getItem(CARE_ITEMS_STORAGE_KEY)
    if (!raw) return DEFAULT_CARE_ITEMS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CARE_ITEMS
  } catch {
    return DEFAULT_CARE_ITEMS
  }
}

function saveCareItems(items) {
  try {
    localStorage.setItem(CARE_ITEMS_STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(CARE_TRACKER_EVENT))
  } catch {
    // Ignore localStorage failures in private mode.
  }
  pushUserData('careItems', items)
}

// Pulls the latest habit list from the server (e.g. added on another device) and merges it in.
export function syncCareItemsFromServer() {
  pullUserData('careItems').then((serverItems) => {
    if (Array.isArray(serverItems) && serverItems.length) {
      localStorage.setItem(CARE_ITEMS_STORAGE_KEY, JSON.stringify(serverItems))
      window.dispatchEvent(new CustomEvent(CARE_TRACKER_EVENT))
    }
  })
}

// Adds a new trackable habit; keywords are comma-separated words matched against to-do text.
export function addCareItem(label, keywordsInput) {
  const items = loadCareItems()
  const trimmedLabel = String(label || '').trim()
  if (!trimmedLabel) return items

  const id = slugify(trimmedLabel)
  if (items.some((item) => item.id === id)) return items

  const keywords = keywordsInput
    ? String(keywordsInput).split(',').map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)
    : [trimmedLabel.toLowerCase()]

  const color = CARE_COLORS[items.length % CARE_COLORS.length]
  const nextItems = [...items, { id, label: trimmedLabel, keywords, color }]
  saveCareItems(nextItems)
  return nextItems
}

export function removeCareItem(itemId) {
  const nextItems = loadCareItems().filter((item) => item.id !== itemId)
  saveCareItems(nextItems)

  // Also drop any logged dates for the removed habit.
  const trackerState = loadCareTracker()
  delete trackerState[itemId]
  try {
    localStorage.setItem(CARE_TRACKER_STORAGE_KEY, JSON.stringify(trackerState))
  } catch {
    // Ignore localStorage failures in private mode.
  }
  pushUserData('careTracker', trackerState)

  return nextItems
}

function emptyState() {
  return loadCareItems().reduce((state, item) => ({ ...state, [item.id]: [] }), {})
}

export function loadCareTracker() {
  const state = emptyState()
  try {
    const raw = localStorage.getItem(CARE_TRACKER_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    Object.keys(state).forEach((itemId) => {
      if (Array.isArray(parsed[itemId])) {
        state[itemId] = parsed[itemId]
      }
    })
    return state
  } catch {
    return state
  }
}

function saveCareTracker(state) {
  try {
    localStorage.setItem(CARE_TRACKER_STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(CARE_TRACKER_EVENT))
  } catch {
    // Ignore localStorage failures in private mode.
  }
  pushUserData('careTracker', state)
}

// Pulls the latest logged dates from the server (e.g. logged on another device) and merges them in.
export function syncCareTrackerFromServer() {
  pullUserData('careTracker').then((serverState) => {
    if (serverState && typeof serverState === 'object') {
      localStorage.setItem(CARE_TRACKER_STORAGE_KEY, JSON.stringify(serverState))
      window.dispatchEvent(new CustomEvent(CARE_TRACKER_EVENT))
    }
  })
}

export { CARE_TRACKER_EVENT }

// Matches a to-do's text against known care items (e.g. "wash my hair" -> hairwash).
export function matchCareItemId(text) {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return null
  const item = loadCareItems().find((candidate) => (
    candidate.keywords.some((keyword) => normalized.includes(keyword))
  ))
  return item ? item.id : null
}

// Adds or removes a single date (YYYY-MM-DD) for a care item and persists the change.
export function setCareDate(itemId, dateKey, present) {
  const state = loadCareTracker()
  const days = new Set(state[itemId] || [])
  if (present) {
    days.add(dateKey)
  } else {
    days.delete(dateKey)
  }
  const nextState = { ...state, [itemId]: [...days].sort() }
  saveCareTracker(nextState)
  return nextState
}

