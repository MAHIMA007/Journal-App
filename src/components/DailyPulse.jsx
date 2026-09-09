import { useEffect, useState } from 'react'
import apiService from '../services/apiService'
import './DailyPulse.css'

const NUDGE_KEY = 'memoir_nudge_last_shown'

function milestoneFor(totalEntries) {
  const milestones = [100, 30, 7]
  return milestones.find((m) => totalEntries >= m) || null
}

function Sparkline({ records }) {
  if (!records || records.length === 0) {
    return <p className="daily-pulse-empty">No mood check-ins yet.</p>
  }

  const recent = records.slice(-14)
  return (
    <div className="mood-sparkline" aria-label="Mood trend over recent check-ins">
      {recent.map((record, index) => (
        <span
          key={`${record.created_at}-${index}`}
          className={`mood-sparkline-bar mood-sparkline-score-${record.score}`}
          style={{ height: `${record.score * 20}%` }}
          title={`${record.mood} (${record.score}/5)`}
        />
      ))}
    </div>
  )
}

function DailyPulse({ username, hasEntryToday, onQuickCapture, onSaveAnswer }) {
  const [streak, setStreak] = useState(null)
  const [onThisDay, setOnThisDay] = useState([])
  const [nextPrompt, setNextPrompt] = useState(null)
  const [moodHistory, setMoodHistory] = useState(null)
  const [weeklySummary, setWeeklySummary] = useState(null)
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false)
  const [promptAnswer, setPromptAnswer] = useState({ open: false, text: '', saving: false, saved: false, error: '' })
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  useEffect(() => {
    let isMounted = true

    Promise.all([
      apiService.getStreak(),
      apiService.getOnThisDay(),
      apiService.getNextPrompts(username || 'default'),
      apiService.getMoodHistory(30),
    ]).then(([streakData, onThisDayData, promptData, moodData]) => {
      if (!isMounted) return
      setStreak(streakData)
      setOnThisDay(Array.isArray(onThisDayData) ? onThisDayData : [])
      setNextPrompt(promptData)
      setPromptAnswer({ open: false, text: '', saving: false, saved: false, error: '' })
      setMoodHistory(moodData)
    })

    return () => {
      isMounted = false
    }
  }, [username])

  // Daily reminder: only nudge once per day, and only if it would break an active streak.
  useEffect(() => {
    if (notifPermission !== 'granted' || !streak || hasEntryToday) return

    const today = new Date().toDateString()
    const lastShown = localStorage.getItem(NUDGE_KEY)
    const isEvening = new Date().getHours() >= 20

    if (lastShown !== today && isEvening && streak.currentStreak > 0) {
      new Notification('Memoir', {
        body: `You're on a ${streak.currentStreak}-day streak — write a few lines before it resets!`,
      })
      localStorage.setItem(NUDGE_KEY, today)
    }
  }, [notifPermission, streak, hasEntryToday])

  const enableReminders = () => {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(setNotifPermission)
  }

  const togglePromptAnswer = () => {
    setPromptAnswer((prev) => ({ ...prev, open: !prev.open }))
  }

  const savePromptAnswer = async () => {
    const answer = promptAnswer.text.trim()
    const promptText = nextPrompt?.prompts?.[0]
    if (!answer || !promptText || !onSaveAnswer) return

    setPromptAnswer((prev) => ({ ...prev, saving: true, error: '' }))

    try {
      await onSaveAnswer({
        title: promptText,
        content: answer,
        tags: ['daily-prompt'],
      })
      setPromptAnswer((prev) => ({ ...prev, saving: false, saved: true, open: false }))
    } catch (saveError) {
      setPromptAnswer((prev) => ({ ...prev, saving: false, error: saveError.message || 'Failed to save entry.' }))
    }
  }

  const generateWeeklyRecap = async () => {
    setIsGeneratingRecap(true)
    try {
      const summary = await apiService.getWeeklySummary()
      setWeeklySummary(summary)
    } catch {
      setWeeklySummary({ summary: 'Could not generate a recap right now. Please try again later.' })
    } finally {
      setIsGeneratingRecap(false)
    }
  }

  const milestone = streak ? milestoneFor(streak.totalEntries) : null

  return (
    <div className="daily-pulse">
      <div className="daily-pulse-row">
        <button type="button" className="daily-pulse-quick-capture" onClick={onQuickCapture}>
          ✏️ Quick Capture
        </button>

        {streak && (
          <div className="daily-pulse-card daily-pulse-streak">
            <span className="daily-pulse-label">Streak</span>
            <strong>🔥 {streak.currentStreak} day{streak.currentStreak === 1 ? '' : 's'}</strong>
            <small>Longest: {streak.longestStreak} · Total entries: {streak.totalEntries}</small>
            {milestone && <span className="daily-pulse-badge">🏅 {milestone}-entry milestone</span>}
          </div>
        )}

        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
          <button type="button" className="daily-pulse-reminder-btn" onClick={enableReminders}>
            🔔 Enable daily reminder
          </button>
        )}
      </div>

      <div className="daily-pulse-row">
        {onThisDay.length > 0 && (
          <div className="daily-pulse-card daily-pulse-memory">
            <span className="daily-pulse-label">On this day</span>
            <strong>{onThisDay[0].title}</strong>
            <p>{onThisDay[0].content.slice(0, 140)}{onThisDay[0].content.length > 140 ? '…' : ''}</p>
            <small>{new Date(onThisDay[0].createdAt).getFullYear()}</small>
          </div>
        )}

        {nextPrompt?.prompts?.length > 0 && (
          <div className="daily-pulse-card daily-pulse-prompt">
            <div className="daily-pulse-prompt-header">
              <span className="daily-pulse-label">Continue the thought</span>
              {onSaveAnswer && (
                <button type="button" className="daily-pulse-prompt-toggle" onClick={togglePromptAnswer}>
                  {promptAnswer.saved ? '✓ Saved' : promptAnswer.open ? 'Cancel' : 'Answer'}
                </button>
              )}
            </div>
            <p>{nextPrompt.prompts[0]}</p>

            {promptAnswer.open && (
              <div className="daily-pulse-prompt-answer">
                <textarea
                  value={promptAnswer.text}
                  onChange={(event) => setPromptAnswer((prev) => ({ ...prev, text: event.target.value, saved: false }))}
                  placeholder="Write your answer..."
                  rows="3"
                />
                {promptAnswer.error && <p className="daily-pulse-prompt-error">{promptAnswer.error}</p>}
                <button
                  type="button"
                  onClick={savePromptAnswer}
                  disabled={promptAnswer.saving || !promptAnswer.text.trim()}
                >
                  {promptAnswer.saving ? 'Saving...' : 'Save as Entry'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="daily-pulse-card daily-pulse-mood">
          <span className="daily-pulse-label">Mood trend</span>
          <Sparkline records={moodHistory?.records} />
        </div>
      </div>

      <div className="daily-pulse-card daily-pulse-recap">
        <span className="daily-pulse-label">Weekly recap</span>
        {weeklySummary ? (
          <p>{weeklySummary.summary}</p>
        ) : (
          <button type="button" onClick={generateWeeklyRecap} disabled={isGeneratingRecap}>
            {isGeneratingRecap ? 'Generating…' : '✨ Generate this week\'s recap'}
          </button>
        )}
      </div>
    </div>
  )
}

export default DailyPulse
