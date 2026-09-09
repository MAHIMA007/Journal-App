import { useEffect, useMemo, useState } from 'react'
import apiService from '../services/apiService'
import { toDateString } from '../utils/dateUtils'
import './ReflectionsPanel.css'

function toDateInputValue(date) {
  return toDateString(date)
}

function getDefaultRange() {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 6)

  return {
    fromDate: toDateInputValue(from),
    toDate: toDateInputValue(to),
  }
}

function ReflectionsPanel({ onSaveAnswer }) {
  const defaults = useMemo(() => getDefaultRange(), [])
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [questionCount, setQuestionCount] = useState(4)
  const [questions, setQuestions] = useState([])
  const [entryCount, setEntryCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState({})

  const loadReflections = async (event) => {
    if (event) {
      event.preventDefault()
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await apiService.getReflections({
        fromDate,
        toDate,
        questionCount,
      })

      setQuestions(Array.isArray(result?.questions) ? result.questions : [])
      setEntryCount(Number(result?.entryCount || 0))
      setAnswers({})
    } catch (loadError) {
      setError(loadError.message || 'Failed to load reflections.')
      setQuestions([])
      setEntryCount(0)
      setAnswers({})
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReflections()
    // Intentionally run on mount to refresh daily reflections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleAnswer = (index) => {
    setAnswers((prev) => {
      const existing = prev[index]
      if (existing?.open) {
        return { ...prev, [index]: { ...existing, open: false } }
      }
      return {
        ...prev,
        [index]: { text: '', saving: false, saved: false, error: '', ...existing, open: true },
      }
    })
  }

  const updateAnswerText = (index, text) => {
    setAnswers((prev) => ({
      ...prev,
      [index]: { ...prev[index], text, saved: false },
    }))
  }

  const saveAnswer = async (index, question) => {
    const answer = answers[index]?.text?.trim()
    if (!answer || !onSaveAnswer) return

    setAnswers((prev) => ({ ...prev, [index]: { ...prev[index], saving: true, error: '' } }))

    try {
      await onSaveAnswer({
        title: question,
        content: answer,
        tags: ['reflection'],
      })
      setAnswers((prev) => ({
        ...prev,
        [index]: { ...prev[index], saving: false, saved: true, open: false },
      }))
    } catch (saveError) {
      setAnswers((prev) => ({
        ...prev,
        [index]: { ...prev[index], saving: false, error: saveError.message || 'Failed to save entry.' },
      }))
    }
  }


  return (
    <section className="reflections-panel">
      <div className="reflections-header">
        <span className="reflections-kicker">Daily Insight</span>
        <h3>Reflections</h3>
        <p>
          Generate questions from your activity between two dates. Choose how many
          prompts you want and refresh any day.
        </p>
      </div>

      <form className="reflections-controls" onSubmit={loadReflections}>
        <div className="reflections-field-group">
          <label htmlFor="reflections-from-date">From</label>
          <input
            id="reflections-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            required
          />
        </div>

        <div className="reflections-field-group">
          <label htmlFor="reflections-to-date">To</label>
          <input
            id="reflections-to-date"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            required
          />
        </div>

        <div className="reflections-field-group">
          <label htmlFor="reflections-question-count">Questions</label>
          <input
            id="reflections-question-count"
            type="number"
            min="3"
            max="5"
            value={questionCount}
            onChange={(event) => setQuestionCount(Number(event.target.value || 3))}
            required
          />
        </div>

        <button className="section-card-button" type="submit" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Update Reflections'}
        </button>
      </form>

      {error && <p className="reflections-error">{error}</p>}

      {!error && (
        <div className="reflections-results">
          <p className="reflections-meta">
            Analyzed {entryCount} {entryCount === 1 ? 'entry' : 'entries'} from {fromDate} to {toDate}
          </p>

          {questions.length > 0 ? (
            <ol className="reflections-question-list">
              {questions.map((question, index) => {
                const answerState = answers[index] || {}
                return (
                  <li key={`${question}-${index}`}>
                    <div className="reflections-question-row">
                      <span>{question}</span>
                      {onSaveAnswer && (
                        <button
                          type="button"
                          className="reflections-answer-toggle"
                          onClick={() => toggleAnswer(index)}
                        >
                          {answerState.saved ? '✓ Saved' : answerState.open ? 'Cancel' : 'Answer'}
                        </button>
                      )}
                    </div>

                    {answerState.open && (
                      <div className="reflections-answer-box">
                        <textarea
                          value={answerState.text || ''}
                          onChange={(event) => updateAnswerText(index, event.target.value)}
                          placeholder="Write your answer..."
                          rows="3"
                        />
                        {answerState.error && (
                          <p className="reflections-answer-error">{answerState.error}</p>
                        )}
                        <div className="reflections-answer-actions">
                          <button
                            type="button"
                            className="section-card-button"
                            disabled={answerState.saving || !answerState.text?.trim()}
                            onClick={() => saveAnswer(index, question)}
                          >
                            {answerState.saving ? 'Saving...' : 'Save as Entry'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="reflections-empty">No questions generated yet. Try adjusting your date range.</p>
          )}
        </div>
      )}
    </section>
  )
}

export default ReflectionsPanel
