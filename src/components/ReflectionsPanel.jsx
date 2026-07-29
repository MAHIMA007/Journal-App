import { useEffect, useMemo, useState } from 'react'
import apiService from '../services/apiService'
import './ReflectionsPanel.css'

function toDateInputValue(date) {
  return date.toISOString().split('T')[0]
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

function ReflectionsPanel() {
  const defaults = useMemo(() => getDefaultRange(), [])
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [questionCount, setQuestionCount] = useState(4)
  const [questions, setQuestions] = useState([])
  const [entryCount, setEntryCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
    } catch (loadError) {
      setError(loadError.message || 'Failed to load reflections.')
      setQuestions([])
      setEntryCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReflections()
    // Intentionally run on mount to refresh daily reflections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              {questions.map((question, index) => (
                <li key={`${question}-${index}`}>{question}</li>
              ))}
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
