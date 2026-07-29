import { useState, useMemo } from 'react'
import './HabitCalendar.css'

const PERIOD_STORAGE_KEY = 'lifelogPeriodTracker'

function toDateString(date) {
  return date.toISOString().split('T')[0]
}

function loadPeriodState() {
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY)
    if (!raw) {
      return { cycleLength: 28, periodLength: 5, loggedDays: [] }
    }

    const parsed = JSON.parse(raw)
    return {
      cycleLength: Number(parsed.cycleLength) || 28,
      periodLength: Number(parsed.periodLength) || 5,
      loggedDays: Array.isArray(parsed.loggedDays) ? parsed.loggedDays : [],
    }
  } catch {
    return { cycleLength: 28, periodLength: 5, loggedDays: [] }
  }
}

function savePeriodState(nextState) {
  try {
    localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(nextState))
  } catch {
    // Ignore localStorage failures in private mode.
  }
}

function HabitCalendar({
  entries,
  onDateClick,
  selectedDate = null,
  compact = false,
  showPeriodTracker = false,
}) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [periodState, setPeriodState] = useState(() => loadPeriodState())
  const [periodStartInput, setPeriodStartInput] = useState(() => toDateString(new Date()))

  // Create a per-day count map for heat-map intensity.
  const entryDateCounts = useMemo(() => {
    const counts = new Map()
    entries.forEach(entry => {
      const date = new Date(entry.createdAt)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
      counts.set(dateStr, (counts.get(dateStr) || 0) + 1)
    })
    return counts
  }, [entries])

  const loggedPeriodDays = useMemo(() => new Set(periodState.loggedDays), [periodState.loggedDays])

  const predictedPeriodDays = useMemo(() => {
    if (!showPeriodTracker || loggedPeriodDays.size === 0) {
      return new Set()
    }

    const sorted = [...loggedPeriodDays].sort()
    let lastStart = sorted[0]

    for (let i = 0; i < sorted.length; i += 1) {
      if (i === 0) continue

      const prev = new Date(sorted[i - 1])
      const curr = new Date(sorted[i])
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24))

      if (diffDays > 1) {
        lastStart = sorted[i]
      }
    }

    const base = new Date(lastStart)
    base.setDate(base.getDate() + periodState.cycleLength)

    const next = new Set()
    for (let i = 0; i < periodState.periodLength; i += 1) {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      next.add(toDateString(d))
    }

    return next
  }, [periodState.cycleLength, periodState.periodLength, loggedPeriodDays, showPeriodTracker])

  // Get first day of month and number of days in month
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()

  // Create array of days for the calendar grid
  const calendarDays = []
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const handleDayClick = (day) => {
    if (!day) return

    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    const dayKey = toDateString(clickedDate)

    if (showPeriodTracker) {
      setPeriodState((previous) => {
        const set = new Set(previous.loggedDays)
        if (set.has(dayKey)) {
          set.delete(dayKey)
        } else {
          set.add(dayKey)
        }

        const nextState = {
          ...previous,
          loggedDays: [...set].sort(),
        }

        savePeriodState(nextState)
        return nextState
      })
    }

    if (onDateClick) {
      onDateClick(clickedDate)
    }
  }

  const updateCycleLength = (nextValue) => {
    const cycleLength = Math.min(45, Math.max(21, Number(nextValue) || 28))
    setPeriodState((previous) => {
      const next = { ...previous, cycleLength }
      savePeriodState(next)
      return next
    })
  }

  const updatePeriodLength = (nextValue) => {
    const periodLength = Math.min(10, Math.max(2, Number(nextValue) || 5))
    setPeriodState((previous) => {
      const next = { ...previous, periodLength }
      savePeriodState(next)
      return next
    })
  }

  const applyPeriodFromDate = () => {
    const start = new Date(periodStartInput)
    if (Number.isNaN(start.getTime())) return

    setPeriodState((previous) => {
      const set = new Set(previous.loggedDays)

      for (let i = 0; i < previous.periodLength; i += 1) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        set.add(toDateString(d))
      }

      const next = {
        ...previous,
        loggedDays: [...set].sort(),
      }

      savePeriodState(next)
      return next
    })
  }

  const getEntryCount = (day) => {
    if (!day) return 0
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0]
    return entryDateCounts.get(dateStr) || 0
  }

  const getHeatLevel = (entryCount) => {
    if (entryCount <= 0) return 0
    if (entryCount === 1) return 1
    if (entryCount === 2) return 2
    if (entryCount <= 4) return 3
    return 4
  }

  const isSelectedDay = (day) => {
    if (!selectedDate || !day) return false
    const target = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0]
    const selected = selectedDate.toISOString().split('T')[0]
    return target === selected
  }

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className={`habit-calendar ${compact ? 'habit-calendar-compact' : ''}`}>
      <div className="calendar-header">
        <button onClick={handlePrevMonth} className="calendar-nav-btn">←</button>
        <h2>{monthYear}</h2>
        <button onClick={handleNextMonth} className="calendar-nav-btn">→</button>
      </div>

      <button onClick={handleToday} className="today-btn">Today</button>

      <div className="calendar-weekdays">
        {weekDays.map(day => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((day, index) => {
          const dayEntryCount = getEntryCount(day)
          const heatLevel = getHeatLevel(dayEntryCount)
          const selected = isSelectedDay(day)
          const dayKey = day
            ? toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
            : ''
          const isPeriodLogged = day ? loggedPeriodDays.has(dayKey) : false
          const isPredictedPeriod = day ? predictedPeriodDays.has(dayKey) : false
          return (
            <div
              key={index}
              className={`calendar-day ${day ? 'day' : 'empty'} heat-level-${heatLevel} ${selected ? 'selected' : ''} ${isPeriodLogged ? 'period-logged' : ''} ${isPredictedPeriod ? 'period-predicted' : ''}`}
              onClick={() => handleDayClick(day)}
            >
              {day && (
                <>
                  <span className="day-number">{day}</span>
                  {dayEntryCount > 0 && <span className="entry-indicator">{dayEntryCount}</span>}
                </>
              )}
            </div>
          )
        })}
      </div>

      <div className="calendar-legend" aria-label="Heat map legend">
        <span>Less</span>
        <span className="legend-dot heat-level-0" />
        <span className="legend-dot heat-level-1" />
        <span className="legend-dot heat-level-2" />
        <span className="legend-dot heat-level-3" />
        <span className="legend-dot heat-level-4" />
        <span>More</span>
      </div>

      {showPeriodTracker && (
        <>
          <div className="period-legend" aria-label="Period tracker legend">
            <span className="period-chip period-chip-logged">Logged period day</span>
            <span className="period-chip period-chip-predicted">Predicted next window</span>
          </div>

          <div className="period-controls">
            <label htmlFor="cycleLength">Cycle</label>
            <input
              id="cycleLength"
              type="number"
              min="21"
              max="45"
              value={periodState.cycleLength}
              onChange={(event) => updateCycleLength(event.target.value)}
            />

            <label htmlFor="periodLength">Days</label>
            <input
              id="periodLength"
              type="number"
              min="2"
              max="10"
              value={periodState.periodLength}
              onChange={(event) => updatePeriodLength(event.target.value)}
            />

            <label htmlFor="periodStartDate">Start</label>
            <input
              id="periodStartDate"
              type="date"
              value={periodStartInput}
              onChange={(event) => setPeriodStartInput(event.target.value)}
            />

            <button
              type="button"
              className="period-set-btn"
              onClick={applyPeriodFromDate}
            >
              Set Period
            </button>
          </div>
        </>
      )}

      <div className="calendar-stats">
        <p className="entries-count">
          {entries.length} total entries
        </p>
        <p className="tracked-days">
          {entryDateCounts.size} active days{showPeriodTracker ? ` • ${loggedPeriodDays.size} period days` : ''}
        </p>
      </div>
    </div>
  )
}

export default HabitCalendar
