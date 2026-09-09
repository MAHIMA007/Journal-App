// Shared store for "important events" (birthdays, anniversaries, appointments, etc.) marked
// directly on the calendar with a star. Also syncs in the background to the server so the
// same account sees the same markers on any device.
import { pullUserData, pushUserData } from './syncedStore'

const EVENT_TRACKER_STORAGE_KEY = 'memoirImportantEvents'
const EVENT_TRACKER_EVENT = 'memoir-important-events-updated'

export function loadImportantEvents() {
  try {
    const raw = localStorage.getItem(EVENT_TRACKER_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveImportantEvents(state) {
  try {
    localStorage.setItem(EVENT_TRACKER_STORAGE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(EVENT_TRACKER_EVENT))
  } catch {
    // Ignore localStorage failures in private mode.
  }
  pushUserData('importantEvents', state)
}

// Pulls the latest markers from the server (e.g. added on another device) and merges them in.
export function syncImportantEventsFromServer() {
  pullUserData('importantEvents').then((serverState) => {
    if (serverState && typeof serverState === 'object') {
      localStorage.setItem(EVENT_TRACKER_STORAGE_KEY, JSON.stringify(serverState))
      window.dispatchEvent(new CustomEvent(EVENT_TRACKER_EVENT))
    }
  })
}

// Adds an important event (title + optional note) to a given date (YYYY-MM-DD key).
export function addImportantEvent(dateKey, title, note) {
  const trimmedTitle = String(title || '').trim()
  if (!trimmedTitle) return loadImportantEvents()

  const state = loadImportantEvents()
  const dayEvents = state[dateKey] || []
  const nextState = {
    ...state,
    [dateKey]: [
      ...dayEvents,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: trimmedTitle, note: String(note || '').trim() },
    ],
  }
  saveImportantEvents(nextState)
  return nextState
}

export function removeImportantEvent(dateKey, eventId) {
  const state = loadImportantEvents()
  const dayEvents = (state[dateKey] || []).filter((event) => event.id !== eventId)
  const nextState = { ...state, [dateKey]: dayEvents }
  if (dayEvents.length === 0) delete nextState[dateKey]
  saveImportantEvents(nextState)
  return nextState
}

export { EVENT_TRACKER_EVENT }
