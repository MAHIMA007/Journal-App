// Shared store for the daily to-do list, syncing in the background to the server
// so the same account sees the same list on any device.
import { pullUserData, pushUserData } from './syncedStore'
import { toDateString } from './dateUtils'

const TODO_STORAGE_KEY = 'memoirDailyTodos'
const TODO_LAST_RESET_KEY = 'memoirTodosLastResetDate'
const TODO_SYNC_EVENT = 'memoir-todos-updated'

function todayDateString() {
  return toDateString(new Date())
}

// Once per calendar day, drop completed to-dos so only unfinished ones carry forward.
function applyDailyReset(todos) {
  const today = todayDateString()
  if (localStorage.getItem(TODO_LAST_RESET_KEY) === today) {
    return todos
  }

  const carriedOver = todos.filter((todo) => !todo.completed)
  localStorage.setItem(TODO_LAST_RESET_KEY, today)
  if (carriedOver.length !== todos.length) {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(carriedOver))
    pushUserData('todos', carriedOver)
  }
  return carriedOver
}

export function loadTodos() {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const todos = Array.isArray(parsed) ? parsed : []
    return applyDailyReset(todos)
  } catch {
    return []
  }
}

export function saveTodos(todos) {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos))
  } catch {
    // Ignore localStorage failures in private mode.
  }
  pushUserData('todos', todos)
}

// Pulls the latest to-dos from the server (e.g. added on another device) and merges them in.
export function syncTodosFromServer() {
  pullUserData('todos').then((serverTodos) => {
    if (Array.isArray(serverTodos)) {
      const merged = applyDailyReset(serverTodos)
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(merged))
      window.dispatchEvent(new CustomEvent(TODO_SYNC_EVENT))
    }
  })
}

export { TODO_SYNC_EVENT }
