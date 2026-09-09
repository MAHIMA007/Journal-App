// Shared store for the "Small steps" habit tracker so a matching to-do can auto check-in a habit.
// Also syncs in the background to the server so the same account sees the same data on any device.
import { pullUserData, pushUserData } from './syncedStore'

const HABIT_STORAGE_KEY = 'memoirHabits'
const HABIT_TRACKER_EVENT = 'memoir-habit-tracker-updated'
const MAX_HABITS = 8

const DEFAULT_HABITS = [
  { id: 'journal', name: 'Journal for 10 minutes', target: 5, keywordsText: '', completions: {} },
  { id: 'move', name: 'Move your body', target: 4, keywordsText: '', completions: {} },
  { id: 'water', name: 'Drink enough water', target: 7, keywordsText: '', completions: {} },
]

export function loadHabits() {
  try {
    const raw = localStorage.getItem(HABIT_STORAGE_KEY)
    if (!raw) return DEFAULT_HABITS

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_HABITS

    return parsed.slice(0, MAX_HABITS).map((habit, index) => ({
      id: habit.id || `habit-${index}`,
      name: habit.name || 'New habit',
      target: Math.min(7, Math.max(1, Number(habit.target) || 3)),
      keywordsText: typeof habit.keywordsText === 'string' ? habit.keywordsText : '',
      completions: habit.completions && typeof habit.completions === 'object'
        ? habit.completions
        : {},
    }))
  } catch {
    return DEFAULT_HABITS
  }
}

export function saveHabits(habits) {
  try {
    localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habits))
    window.dispatchEvent(new CustomEvent(HABIT_TRACKER_EVENT))
  } catch {
    // Ignore localStorage failures in private mode.
  }
  pushUserData('habits', habits)
}

// Pulls the latest habits from the server (e.g. checked in on another device) and merges them in.
export function syncHabitsFromServer() {
  pullUserData('habits').then((serverHabits) => {
    if (Array.isArray(serverHabits) && serverHabits.length) {
      localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(serverHabits))
      window.dispatchEvent(new CustomEvent(HABIT_TRACKER_EVENT))
    }
  })
}

// Matches a to-do's text against habit names/keywords (e.g. "hairwash" -> a habit named "Hair wash").
export function matchHabitId(text) {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized) return null

  const habit = loadHabits().find((candidate) => {
    const keywords = candidate.keywordsText
      ? candidate.keywordsText.split(',').map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)
      : [candidate.name.trim().toLowerCase()]
    return keywords.some((keyword) => keyword && normalized.includes(keyword))
  })
  return habit ? habit.id : null
}

// Adds or removes a single date (YYYY-MM-DD) check-in for a habit and persists the change.
export function setHabitDate(habitId, dateKey, present) {
  const habits = loadHabits()
  const nextHabits = habits.map((habit) => {
    if (habit.id !== habitId) return habit
    const completions = { ...habit.completions }
    if (present) {
      completions[dateKey] = true
    } else {
      delete completions[dateKey]
    }
    return { ...habit, completions }
  })
  saveHabits(nextHabits)
  return nextHabits
}

export { HABIT_TRACKER_EVENT, DEFAULT_HABITS, MAX_HABITS }
