import { useMemo, useState, useEffect } from 'react'
import './HabitTracker.css'
import { HABIT_TRACKER_EVENT, MAX_HABITS, loadHabits, saveHabits, syncHabitsFromServer } from '../utils/habitTracker'
import { toDateString } from '../utils/dateUtils'

const PROMPTS = [
  'What would make today feel meaningful?',
  'What is asking for your attention right now?',
  'What helped you feel like yourself this week?',
  'What is one kind thing you can do for tomorrow-you?',
]

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return date
  })
}

// Consecutive prior weeks that met target minus 1 grace miss, so a single off day doesn't reset progress.
function computeWeekStreak(habits) {
  if (!habits.length) return 0

  const weekTarget = habits.reduce((total, habit) => total + habit.target, 0)
  const today = new Date()
  const day = today.getDay()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - (day === 0 ? 6 : day - 1) - 7)
  weekStart.setHours(0, 0, 0, 0)

  let streak = 0
  for (let week = 0; week < 52; week++) {
    const dateKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      return toDateString(date)
    })
    const total = habits.reduce((sum, habit) => (
      sum + dateKeys.filter((key) => habit.completions[key]).length
    ), 0)

    if (total >= Math.max(0, weekTarget - 1)) {
      streak++
      weekStart.setDate(weekStart.getDate() - 7)
    } else {
      break
    }
  }
  return streak
}

function HabitTracker({ onSaveAnswer }) {
  const [habits, setHabits] = useState(() => loadHabits())
  const [isAdding, setIsAdding] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitKeywords, setNewHabitKeywords] = useState('')
  const [promptIndex, setPromptIndex] = useState(() => new Date().getDate() % PROMPTS.length)
  const [promptAnswer, setPromptAnswer] = useState({ open: false, text: '', saving: false, saved: false, error: '' })
  const [trackingView, setTrackingView] = useState('weekly')
  const weekDates = useMemo(() => getWeekDates(), [])
  const todayKey = toDateString(new Date())

  // Keep in sync when a matching to-do checks in a habit elsewhere (e.g. TodoList),
  // and pull the latest from the server on mount (e.g. checked in on another device).
  useEffect(() => {
    syncHabitsFromServer()
    const refreshHabits = () => setHabits(loadHabits())
    window.addEventListener(HABIT_TRACKER_EVENT, refreshHabits)
    window.addEventListener('storage', refreshHabits)
    return () => {
      window.removeEventListener(HABIT_TRACKER_EVENT, refreshHabits)
      window.removeEventListener('storage', refreshHabits)
    }
  }, [])

  const updateHabits = (nextHabits) => {
    setHabits(nextHabits)
    saveHabits(nextHabits)
  }

  const cyclePrompt = () => {
    setPromptIndex((index) => (index + 1) % PROMPTS.length)
    setPromptAnswer({ open: false, text: '', saving: false, saved: false, error: '' })
  }

  const togglePromptAnswer = () => {
    setPromptAnswer((prev) => ({ ...prev, open: !prev.open }))
  }

  const savePromptAnswer = async () => {
    const answer = promptAnswer.text.trim()
    if (!answer || !onSaveAnswer) return

    setPromptAnswer((prev) => ({ ...prev, saving: true, error: '' }))

    try {
      await onSaveAnswer({
        title: PROMPTS[promptIndex],
        content: answer,
        tags: ['daily-prompt'],
      })
      setPromptAnswer((prev) => ({ ...prev, saving: false, saved: true, open: false }))
    } catch (saveError) {
      setPromptAnswer((prev) => ({ ...prev, saving: false, error: saveError.message || 'Failed to save entry.' }))
    }
  }

  const toggleToday = (habitId) => {
    updateHabits(habits.map((habit) => {
      if (habit.id !== habitId) return habit
      const completions = { ...habit.completions }
      if (completions[todayKey]) {
        delete completions[todayKey]
      } else {
        completions[todayKey] = true
      }
      return { ...habit, completions }
    }))
  }

  const toggleDate = (habitId, dateKey) => {
    updateHabits(habits.map((habit) => {
      if (habit.id !== habitId) return habit
      const completions = { ...habit.completions }
      if (completions[dateKey]) {
        delete completions[dateKey]
      } else {
        completions[dateKey] = true
      }
      return { ...habit, completions }
    }))
  }

  const updateHabit = (habitId, field, value) => {
    updateHabits(habits.map((habit) => (
      habit.id === habitId
        ? { ...habit, [field]: field === 'target' ? Math.min(7, Math.max(1, Number(value) || 1)) : value }
        : habit
    )))
  }

  const addHabit = (event) => {
    event.preventDefault()
    const name = newHabitName.trim()
    if (!name || habits.length >= MAX_HABITS) return

    updateHabits([
      ...habits,
      { id: `habit-${Date.now()}`, name, target: 3, keywordsText: newHabitKeywords.trim(), completions: {} },
    ])
    setNewHabitName('')
    setNewHabitKeywords('')
    setIsAdding(false)
  }

  const removeHabit = (habitId) => {
    updateHabits(habits.filter((habit) => habit.id !== habitId))
  }

  const weekTotal = habits.reduce((total, habit) => (
    total + weekDates.filter((date) => habit.completions[toDateString(date)]).length
  ), 0)
  const weekTarget = habits.reduce((total, habit) => total + habit.target, 0)
  const progress = weekTarget ? Math.min(100, Math.round((weekTotal / weekTarget) * 100)) : 0
  const monthDates = useMemo(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(firstDay)
      date.setDate(index + 1)
      return date
    })
  }, [])
  const monthTotal = habits.reduce((total, habit) => (
    total + monthDates.filter((date) => habit.completions[toDateString(date)]).length
  ), 0)
  const monthTarget = habits.reduce((total, habit) => total + habit.target * 4, 0)
  const displayedProgress = trackingView === 'weekly'
    ? progress
    : monthTarget ? Math.min(100, Math.round((monthTotal / monthTarget) * 100)) : 0
  const weekStreak = useMemo(() => computeWeekStreak(habits), [habits])

  return (
    <article className="habit-tracker">
      <header className="habit-tracker-header">
        <div>
          <span className="section-card-label">Small steps</span>
          <h3>Habit tracking</h3>
          {weekStreak > 0 && (
            <span className="habit-week-streak">🔥 {weekStreak} week streak (1 grace miss/week)</span>
          )}
        </div>
        <span className="habit-progress-value">{displayedProgress}%</span>
      </header>

      <div className="habit-progress-track" aria-label={`${progress}% of weekly habit targets complete`}>
        <span style={{ width: `${displayedProgress}%` }} />
      </div>
      <div className="habit-view-switcher" role="tablist" aria-label="Habit tracking period">
        <button
          type="button"
          className={trackingView === 'weekly' ? 'is-active' : ''}
          onClick={() => setTrackingView('weekly')}
          role="tab"
          aria-selected={trackingView === 'weekly'}
        >
          Weekly
        </button>
        <button
          type="button"
          className={trackingView === 'monthly' ? 'is-active' : ''}
          onClick={() => setTrackingView('monthly')}
          role="tab"
          aria-selected={trackingView === 'monthly'}
        >
          Monthly
        </button>
      </div>
      <p className="habit-progress-copy">
        {trackingView === 'weekly'
          ? `${weekTotal} of ${weekTarget} weekly check-ins`
          : `${monthTotal} check-ins this month`}
      </p>

      <div className="habit-list">
        {habits.map((habit) => {
          const completedToday = Boolean(habit.completions[todayKey])
          const completedThisWeek = weekDates.filter((date) => habit.completions[toDateString(date)]).length
          return (
            <div className="habit-row" key={habit.id}>
              <button
                type="button"
                className={`habit-check ${completedToday ? 'is-complete' : ''}`}
                onClick={() => toggleToday(habit.id)}
                aria-label={`${completedToday ? 'Undo' : 'Complete'} ${habit.name} for today`}
              >
                {completedToday ? '✓' : ''}
              </button>
              <div className="habit-details">
                <input
                  className="habit-name"
                  value={habit.name}
                  onChange={(event) => updateHabit(habit.id, 'name', event.target.value)}
                  aria-label="Habit name"
                />
                <input
                  className="habit-keywords"
                  value={habit.keywordsText || ''}
                  onChange={(event) => updateHabit(habit.id, 'keywordsText', event.target.value)}
                  placeholder="Match words in to-do list (optional, comma separated)"
                  aria-label={`Match words for ${habit.name}`}
                />
                <div className="habit-week" aria-label={`${completedThisWeek} of ${habit.target} check-ins this week`}>
                  {(trackingView === 'weekly' ? weekDates : monthDates).map((date) => {
                    const dateKey = toDateString(date)
                    return (
                      <button
                        type="button"
                        className={`habit-day ${trackingView === 'monthly' ? 'habit-day-month' : ''} ${habit.completions[dateKey] ? 'is-complete' : ''} ${dateKey === todayKey ? 'is-today' : ''}`}
                        key={dateKey}
                        onClick={() => toggleDate(habit.id, dateKey)}
                        aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long' })}: ${habit.completions[dateKey] ? 'complete' : 'not complete'}`}
                      >
                        {trackingView === 'weekly'
                          ? date.toLocaleDateString('en-US', { weekday: 'narrow' })
                          : date.getDate()}
                      </button>
                    )
                  })}
                  <span className="habit-target">
                    {completedThisWeek}/
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={habit.target}
                      onChange={(event) => updateHabit(habit.id, 'target', event.target.value)}
                      aria-label={`Weekly target for ${habit.name}`}
                    />
                  </span>
                </div>
              </div>
              <button type="button" className="habit-remove" onClick={() => removeHabit(habit.id)} aria-label={`Remove ${habit.name}`}>
                ×
              </button>
            </div>
          )
        })}
      </div>

      {isAdding ? (
        <form className="habit-add-form" onSubmit={addHabit}>
          <input
            autoFocus
            value={newHabitName}
            onChange={(event) => setNewHabitName(event.target.value)}
            placeholder="Name a habit"
            aria-label="New habit name"
            maxLength="40"
          />
          <input
            value={newHabitKeywords}
            onChange={(event) => setNewHabitKeywords(event.target.value)}
            placeholder="Match words in to-do list (optional, comma separated)"
            aria-label="Match words for new habit"
          />
          <button type="submit">Add</button>
          <button type="button" onClick={() => setIsAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button
          type="button"
          className="habit-add-button"
          onClick={() => setIsAdding(true)}
          disabled={habits.length >= MAX_HABITS}
        >
          {habits.length >= MAX_HABITS ? `${MAX_HABITS} habits in focus` : '+ Add habit'}
        </button>
      )}

      <div className="habit-focus-grid">
        <section className="habit-focus-section">
          <div className="habit-focus-heading">
            <span className="section-card-label">Daily prompt</span>
            <button type="button" onClick={cyclePrompt}>
              New prompt
            </button>
          </div>
          <p className="habit-prompt">{PROMPTS[promptIndex]}</p>

          {onSaveAnswer && (
            <button type="button" className="habit-prompt-answer-toggle" onClick={togglePromptAnswer}>
              {promptAnswer.saved ? '✓ Saved' : promptAnswer.open ? 'Cancel' : 'Answer'}
            </button>
          )}

          {promptAnswer.open && (
            <div className="habit-prompt-answer">
              <textarea
                value={promptAnswer.text}
                onChange={(event) => setPromptAnswer((prev) => ({ ...prev, text: event.target.value, saved: false }))}
                placeholder="Write your answer..."
                rows="3"
              />
              {promptAnswer.error && <p className="habit-prompt-error">{promptAnswer.error}</p>}
              <button
                type="button"
                onClick={savePromptAnswer}
                disabled={promptAnswer.saving || !promptAnswer.text.trim()}
              >
                {promptAnswer.saving ? 'Saving...' : 'Save as Entry'}
              </button>
            </div>
          )}
        </section>
      </div>
    </article>
  )
}

export default HabitTracker
