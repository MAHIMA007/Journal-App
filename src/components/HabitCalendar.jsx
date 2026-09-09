import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './HabitCalendar.css'
import {
  CARE_TRACKER_EVENT,
  loadCareItems,
  loadCareTracker,
  setCareDate,
  addCareItem,
  removeCareItem,
  syncCareItemsFromServer,
  syncCareTrackerFromServer,
} from '../utils/careTracker'
import {
  EVENT_TRACKER_EVENT,
  loadImportantEvents,
  addImportantEvent,
  removeImportantEvent,
  syncImportantEventsFromServer,
} from '../utils/eventTracker'
import { toDateString } from '../utils/dateUtils'

const PERIOD_STORAGE_KEY = 'memoirPeriodTracker'

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
  const [careItems, setCareItems] = useState(() => loadCareItems())
  const [careState, setCareState] = useState(() => loadCareTracker())
  const [careDateInput, setCareDateInput] = useState(() => toDateString(new Date()))
  const [isAddingCareItem, setIsAddingCareItem] = useState(false)
  const [newCareLabel, setNewCareLabel] = useState('')
  const [newCareKeywords, setNewCareKeywords] = useState('')
  const [importantEvents, setImportantEvents] = useState(() => loadImportantEvents())
  const [eventPopupDateKey, setEventPopupDateKey] = useState(null)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventNote, setNewEventNote] = useState('')
  const [hoveredEventDay, setHoveredEventDay] = useState(null)

  const showEventTooltip = (dateKey, events, targetElement) => {
    const rect = targetElement.getBoundingClientRect()
    const tooltipWidth = 220
    const left = Math.min(
      Math.max(8, rect.right - tooltipWidth),
      window.innerWidth - tooltipWidth - 8,
    )
    setHoveredEventDay({ dateKey, events, top: rect.bottom + 6, left })
  }

  const hideEventTooltip = () => setHoveredEventDay(null)

  // Keep in sync with care items/logs updated elsewhere (e.g. checked off in the to-do list),
  // and pull the latest from the server on mount (e.g. logged on another device).
  useEffect(() => {
    syncCareItemsFromServer()
    syncCareTrackerFromServer()
    syncImportantEventsFromServer()
    const refreshCareData = () => {
      setCareItems(loadCareItems())
      setCareState(loadCareTracker())
    }
    const refreshImportantEvents = () => setImportantEvents(loadImportantEvents())
    window.addEventListener(CARE_TRACKER_EVENT, refreshCareData)
    window.addEventListener('storage', refreshCareData)
    window.addEventListener(EVENT_TRACKER_EVENT, refreshImportantEvents)
    window.addEventListener('storage', refreshImportantEvents)
    return () => {
      window.removeEventListener(CARE_TRACKER_EVENT, refreshCareData)
      window.removeEventListener('storage', refreshCareData)
      window.removeEventListener(EVENT_TRACKER_EVENT, refreshImportantEvents)
      window.removeEventListener('storage', refreshImportantEvents)
    }
  }, [])

  const openEventPopup = (dayKey, event) => {
    event.stopPropagation()
    setNewEventTitle('')
    setNewEventNote('')
    setEventPopupDateKey(dayKey)
  }

  const closeEventPopup = () => {
    setEventPopupDateKey(null)
    setNewEventTitle('')
    setNewEventNote('')
  }

  const submitNewImportantEvent = (event) => {
    event.preventDefault()
    if (!newEventTitle.trim() || !eventPopupDateKey) return
    setImportantEvents(addImportantEvent(eventPopupDateKey, newEventTitle, newEventNote))
    setNewEventTitle('')
    setNewEventNote('')
  }

  const deleteImportantEvent = (dateKey, eventId) => {
    setImportantEvents(removeImportantEvent(dateKey, eventId))
  }

  const logCareDate = (itemId) => {
    setCareState(setCareDate(itemId, careDateInput, true))
  }

  const removeCareDate = (itemId, dateKey) => {
    setCareState(setCareDate(itemId, dateKey, false))
  }

  const submitNewCareItem = (event) => {
    event.preventDefault()
    if (!newCareLabel.trim()) return
    setCareItems(addCareItem(newCareLabel, newCareKeywords))
    setNewCareLabel('')
    setNewCareKeywords('')
    setIsAddingCareItem(false)
  }

  const deleteCareItem = (itemId) => {
    setCareItems(removeCareItem(itemId))
    setCareState(loadCareTracker())
  }

  // Create a per-day count map for heat-map intensity.
  const entryDateCounts = useMemo(() => {
    const counts = new Map()
    entries.forEach(entry => {
      const date = new Date(entry.createdAt)
      const dateStr = toDateString(date)
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

  const predictedLutealDays = useMemo(() => {
    if (!showPeriodTracker || loggedPeriodDays.size === 0) {
      return new Set()
    }

    const sorted = [...loggedPeriodDays].sort()
    let lastStart = sorted[0]

    for (let i = 1; i < sorted.length; i += 1) {
      const previous = new Date(sorted[i - 1])
      const current = new Date(sorted[i])
      const diffDays = Math.round((current - previous) / (1000 * 60 * 60 * 24))

      if (diffDays > 1) {
        lastStart = sorted[i]
      }
    }

    const nextPeriodStart = new Date(lastStart)
    nextPeriodStart.setDate(nextPeriodStart.getDate() + periodState.cycleLength)

    const lutealStart = new Date(nextPeriodStart)
    lutealStart.setDate(lutealStart.getDate() - 14)

    const next = new Set()
    for (let i = 0; i < 14; i += 1) {
      const date = new Date(lutealStart)
      date.setDate(date.getDate() + i)
      next.add(toDateString(date))
    }

    return next
  }, [periodState.cycleLength, loggedPeriodDays, showPeriodTracker])

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
    const dateStr = toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
    return entryDateCounts.get(dateStr) || 0
  }

  const getHeatLevel = (entryCount) => {
    if (entryCount <= 0) return 0
    if (entryCount === 1) return 1
    if (entryCount === 2) return 2
    if (entryCount <= 4) return 3
    return 4
  }

  const currentMonthEntries = entries.filter((entry) => {
    const date = new Date(entry.createdAt)
    return date.getFullYear() === currentDate.getFullYear()
      && date.getMonth() === currentDate.getMonth()
  })
  const currentMonthEntryDays = new Set(currentMonthEntries.map((entry) => {
    const date = new Date(entry.createdAt)
    return toDateString(date)
  }))
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === currentDate.getFullYear()
    && today.getMonth() === currentDate.getMonth()
  const elapsedDays = isCurrentMonth ? today.getDate() : daysInMonth
  let currentStreak = 0
  for (let index = 0; index < elapsedDays; index += 1) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), elapsedDays - index)
    if (!currentMonthEntryDays.has(toDateString(date))) break
    currentStreak += 1
  }

  const isSelectedDay = (day) => {
    if (!selectedDate || !day) return false
    const target = toDateString(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
    const selected = toDateString(selectedDate)
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

      <div className="calendar-summary" aria-label="Journal activity summary">
        <div>
          <strong>{currentMonthEntryDays.size}</strong>
          <span>active days</span>
        </div>
        <div>
          <strong>{currentMonthEntries.length}</strong>
          <span>entries this month</span>
        </div>
        <div>
          <strong>{currentStreak}</strong>
          <span>day streak</span>
        </div>
      </div>

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
          const isPredictedLuteal = day ? predictedLutealDays.has(dayKey) : false
          const careDots = day
            ? careItems.filter((item) => (careState[item.id] || []).includes(dayKey))
            : []
          const dayEvents = day ? (importantEvents[dayKey] || []) : []
          return (
            <div
              key={index}
              className={`calendar-day ${day ? 'day' : 'empty'} heat-level-${heatLevel} ${selected ? 'selected' : ''} ${isPeriodLogged ? 'period-logged' : ''} ${isPredictedPeriod ? 'period-predicted' : ''} ${isPredictedLuteal ? 'period-luteal' : ''}`}
              onClick={() => handleDayClick(day)}
              onDoubleClick={(event) => day && openEventPopup(dayKey, event)}
              onMouseEnter={(event) => dayEvents.length > 0 && showEventTooltip(dayKey, dayEvents, event.currentTarget)}
              onMouseLeave={() => dayEvents.length > 0 && hideEventTooltip()}
            >
              {day && (
                <>
                  <span className="day-number">{day}</span>
                  {dayEvents.length > 0 && (
                    <button
                      type="button"
                      className="important-event-star has-events"
                      onClick={(event) => openEventPopup(dayKey, event)}
                      aria-label={`View important events on ${dayKey}`}
                    >
                      ★
                    </button>
                  )}
                  {dayEvents.length > 0 && (
                    <span className="important-event-line" title={dayEvents.map((eventItem) => eventItem.title).join(', ')}>
                      {dayEvents[0].title}
                      {dayEvents.length > 1 && ` +${dayEvents.length - 1}`}
                    </span>
                  )}
                  {careDots.length > 0 && (
                    <span className="care-day-dots">
                      {careDots.map((item) => (
                        <span
                          key={item.id}
                          className="care-day-dot"
                          style={{ backgroundColor: item.color }}
                          title={item.label}
                        />
                      ))}
                    </span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {hoveredEventDay && createPortal(
        <div
          className="important-event-tooltip"
          role="tooltip"
          style={{ top: hoveredEventDay.top, left: hoveredEventDay.left }}
        >
          {hoveredEventDay.events.map((eventItem) => (
            <span className="important-event-tooltip-row" key={eventItem.id}>
              <strong>{eventItem.title}</strong>
              {eventItem.note && <span>{eventItem.note}</span>}
            </span>
          ))}
        </div>,
        document.body,
      )}

      {eventPopupDateKey && createPortal(
        <div className="important-event-popup-overlay" onClick={closeEventPopup}>
          <div className="important-event-popup" onClick={(event) => event.stopPropagation()}>
            <div className="important-event-popup-header">
              <h3>Important events — {eventPopupDateKey}</h3>
              <button type="button" className="important-event-popup-close" onClick={closeEventPopup} aria-label="Close">×</button>
            </div>

            {(importantEvents[eventPopupDateKey] || []).length > 0 && (
              <ul className="important-event-list">
                {importantEvents[eventPopupDateKey].map((eventItem) => (
                  <li key={eventItem.id} className="important-event-list-item">
                    <div>
                      <strong>{eventItem.title}</strong>
                      {eventItem.note && <p>{eventItem.note}</p>}
                    </div>
                    <button
                      type="button"
                      className="important-event-remove"
                      onClick={() => deleteImportantEvent(eventPopupDateKey, eventItem.id)}
                      aria-label={`Remove ${eventItem.title}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form className="important-event-form" onSubmit={submitNewImportantEvent}>
              <input
                autoFocus
                value={newEventTitle}
                onChange={(event) => setNewEventTitle(event.target.value)}
                placeholder="Event title (e.g. Mom's birthday)"
                aria-label="Important event title"
                maxLength="60"
              />
              <textarea
                value={newEventNote}
                onChange={(event) => setNewEventNote(event.target.value)}
                placeholder="Notes (optional)"
                aria-label="Important event notes"
                rows="3"
                maxLength="300"
              />
              <button type="submit" className="important-event-save-btn">Save event</button>
            </form>
          </div>
        </div>,
        document.body,
      )}

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
            <span className="period-chip period-chip-luteal">Tentative luteal phase</span>
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

      <div className="care-tracker" aria-label="Self-care tracking">
        <span className="section-card-label">Self-care tracking</span>
        <p className="care-tracker-hint">Check these off in your to-do list to auto-log them here, or add a date manually.</p>

        {careItems.map((item) => {
          const loggedDays = careState[item.id] || []
          const monthLoggedDays = loggedDays.filter((dateKey) => {
            const [year, month] = dateKey.split('-').map(Number)
            return year === currentDate.getFullYear() && month === currentDate.getMonth() + 1
          })
          return (
            <div className="care-tracker-item" key={item.id}>
              <div className="care-tracker-row">
                <span className="care-tracker-dot" style={{ backgroundColor: item.color }} />
                <span className="care-tracker-label">{item.label}</span>
                <span className="care-tracker-count">{monthLoggedDays.length} this month</span>
                <input
                  type="date"
                  value={careDateInput}
                  onChange={(event) => setCareDateInput(event.target.value)}
                  aria-label={`Date to log ${item.label}`}
                />
                <button type="button" onClick={() => logCareDate(item.id)}>Log</button>
                <button
                  type="button"
                  className="care-tracker-remove"
                  onClick={() => deleteCareItem(item.id)}
                  aria-label={`Remove ${item.label} habit`}
                >
                  ×
                </button>
              </div>
              {monthLoggedDays.length > 0 && (
                <div className="care-tracker-chips">
                  {monthLoggedDays.map((dateKey) => {
                    const [year, month, day] = dateKey.split('-').map(Number)
                    const displayDate = new Date(year, month - 1, day)
                    return (
                      <span className="care-tracker-chip" key={dateKey}>
                        {displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        <button
                          type="button"
                          onClick={() => removeCareDate(item.id, dateKey)}
                          aria-label={`Remove ${item.label} on ${dateKey}`}
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {isAddingCareItem ? (
          <form className="care-tracker-add-form" onSubmit={submitNewCareItem}>
            <input
              autoFocus
              value={newCareLabel}
              onChange={(event) => setNewCareLabel(event.target.value)}
              placeholder="Habit name (e.g. Skincare)"
              aria-label="New self-care habit name"
              maxLength="40"
            />
            <input
              value={newCareKeywords}
              onChange={(event) => setNewCareKeywords(event.target.value)}
              placeholder="Match words in to-do list (optional, comma separated)"
              aria-label="Keywords to match in to-do list"
            />
            <div className="care-tracker-add-actions">
              <button type="submit">Add habit</button>
              <button type="button" onClick={() => setIsAddingCareItem(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="care-tracker-add-btn"
            onClick={() => setIsAddingCareItem(true)}
          >
            + Add self-care habit
          </button>
        )}
      </div>

    </div>
  )
}

export default HabitCalendar
