import { useEffect, useMemo, useState } from 'react'
import './StructuredJournal.css'
import apiService from '../services/apiService'
import FileUpload from './FileUpload'

function StructuredJournal({ onCreateEntry, onUploadEntries }) {
  const [focusArea, setFocusArea] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [prompts, setPrompts] = useState([])
  const [promptAnswers, setPromptAnswers] = useState([])
  const [draftTitle, setDraftTitle] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [suggestedFocusAreas, setSuggestedFocusAreas] = useState([])

  useEffect(() => {
    let isMounted = true

    const loadFocusAreas = async () => {
      try {
        const response = await apiService.getFocusAreas(6)
        if (!isMounted) return

        const areas = Array.isArray(response?.focusAreas) ? response.focusAreas : []
        setSuggestedFocusAreas(areas)
      } catch (focusError) {
        if (!isMounted) return
        setSuggestedFocusAreas([])
      }
    }

    loadFocusAreas()

    return () => {
      isMounted = false
    }
  }, [])

  const canGenerate = useMemo(() => focusArea.trim().length > 2, [focusArea])

  const handleGenerate = async (event) => {
    event.preventDefault()
    if (!canGenerate) {
      setError('Please enter a focus area first.')
      return
    }

    setIsGenerating(true)
    setError('')

    try {
      const result = await apiService.generateStructuredPrompts(focusArea.trim(), 5)
      const nextPrompts = Array.isArray(result.prompts) ? result.prompts : []
      setPrompts(nextPrompts)
      setPromptAnswers(new Array(nextPrompts.length).fill(''))
      setStatusMessage('')
    } catch (apiError) {
      setError(apiError.message || 'Failed to generate prompts. Please try again.')
      setPrompts([])
      setPromptAnswers([])
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUseAsDraft = () => {
    if (!prompts.length) return

    setDraftTitle(`Structured: ${focusArea.trim()}`)
    setPromptAnswers((currentAnswers) => {
      if (currentAnswers.length === prompts.length) {
        return currentAnswers
      }
      return new Array(prompts.length).fill('')
    })
    setDraftTags(focusArea.trim())
    setStatusMessage('Draft loaded. Fill each question below like a form and save directly from Structured mode.')
  }

  const buildStructuredContent = () => {
    const lines = []

    if (focusArea.trim()) {
      lines.push(`Focus Area: ${focusArea.trim()}`)
      lines.push('')
    }

    if (prompts.length > 0) {
      prompts.forEach((prompt, index) => {
        const answer = String(promptAnswers[index] || '').trim()
        lines.push(`${index + 1}. ${prompt}`)
        lines.push(`Answer: ${answer || '(no response yet)'}`)
        lines.push('')
      })
    }

    if (additionalNotes.trim()) {
      lines.push('Additional Notes:')
      lines.push(additionalNotes.trim())
    }

    return lines.join('\n').trim()
  }

  const handlePromptAnswerChange = (index, value) => {
    setPromptAnswers((currentAnswers) => {
      const next = [...currentAnswers]
      next[index] = value
      return next
    })
  }

  const handleSaveDraft = async (event) => {
    event.preventDefault()

    const title = draftTitle.trim() || (focusArea.trim() ? `Structured: ${focusArea.trim()}` : 'Untitled Structured Entry')
    const content = buildStructuredContent()
    const hasPromptResponses = promptAnswers.some((answer) => String(answer || '').trim().length > 0)
    const hasTypedNotes = additionalNotes.trim().length > 0

    if (!hasPromptResponses && !hasTypedNotes) {
      setError('Add at least one answer or some notes before saving.')
      return
    }

    if (!content) {
      setError('Content is required to save.')
      return
    }

    setIsSaving(true)
    setError('')
    setStatusMessage('')

    try {
      await onCreateEntry({
        title,
        content,
        tags: draftTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      })

      setStatusMessage('Saved! Your structured journal entry was added without leaving this page.')
    } catch (saveError) {
      setError(saveError.message || 'Failed to save entry. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadedEntries = (uploadedEntries) => {
    onUploadEntries(uploadedEntries)
    setStatusMessage(`Imported ${uploadedEntries.length} file-based entr${uploadedEntries.length === 1 ? 'y' : 'ies'} from Structured mode.`)
  }

  return (
    <section className="structured-journal">
      <div className="structured-journal-header">
        <span className="structured-kicker">AI Prompt Builder</span>
        <h2>Structured Journal</h2>
        <p>
          Focus areas are pulled from your previous entries. Pick one and generate guided prompts.
        </p>
      </div>

      <form className="structured-form" onSubmit={handleGenerate}>
        <label htmlFor="focusArea">Focus Area</label>
        <input
          id="focusArea"
          type="text"
          value={focusArea}
          onChange={(event) => setFocusArea(event.target.value)}
          placeholder="Understand myself better"
        />

        {suggestedFocusAreas.length > 0 && (
          <div className="focus-chip-list">
            {suggestedFocusAreas.map((area) => (
              <button
                key={area}
                type="button"
                className="focus-chip"
                onClick={() => setFocusArea(area)}
              >
                {area}
              </button>
            ))}
          </div>
        )}

        <button type="submit" className="section-card-button" disabled={isGenerating || !canGenerate}>
          {isGenerating ? 'Generating prompts...' : 'Generate Prompts'}
        </button>
      </form>

      {error && <p className="structured-error">{error}</p>}
      {statusMessage && <p className="structured-success">{statusMessage}</p>}

      {prompts.length > 0 && (
        <div className="structured-results">
          <div className="structured-results-header">
            <h3>Guided Prompts</h3>
            <button type="button" className="section-card-button" onClick={handleUseAsDraft}>
              Use as Journal Draft
            </button>
          </div>

          <ol>
            {prompts.map((prompt, index) => (
              <li key={`${prompt}-${index}`}>{prompt}</li>
            ))}
          </ol>
        </div>
      )}

      <section className="structured-editor-section">
        <div className="structured-editor-header">
          <h3>Write Here Directly</h3>
          <p>Type your structured entry here, or start from generated prompts above.</p>
        </div>

        <form className="structured-editor-form" onSubmit={handleSaveDraft}>
          <label htmlFor="structuredTitle">Title</label>
          <input
            id="structuredTitle"
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Structured reflection title (optional)"
          />

          <label htmlFor="structuredTags">Tags</label>
          <input
            id="structuredTags"
            type="text"
            value={draftTags}
            onChange={(event) => setDraftTags(event.target.value)}
            placeholder={focusArea.trim() || 'self-growth'}
          />

          {prompts.length > 0 && (
            <div className="structured-question-list">
              {prompts.map((prompt, index) => (
                <div key={`${prompt}-${index}`} className="structured-question-card">
                  <label htmlFor={`prompt-answer-${index}`}>{`Q${index + 1}. ${prompt}`}</label>
                  <textarea
                    id={`prompt-answer-${index}`}
                    value={promptAnswers[index] || ''}
                    onChange={(event) => handlePromptAnswerChange(index, event.target.value)}
                    placeholder="Write your response here"
                    rows="4"
                  />
                </div>
              ))}
            </div>
          )}

          <label htmlFor="structuredNotes">Additional Notes</label>
          <textarea
            id="structuredNotes"
            value={additionalNotes}
            onChange={(event) => setAdditionalNotes(event.target.value)}
            placeholder="Add anything else you want to capture"
            rows="6"
          />

          <button type="submit" className="section-card-button" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Structured Entry'}
          </button>
        </form>
      </section>

      <section className="structured-upload-section">
        <div className="structured-editor-header">
          <h3>Upload in Structured Mode</h3>
          <p>Use the same file import workflow here without switching to Dump.</p>
        </div>
        <FileUpload onUpload={handleUploadedEntries} />
      </section>
    </section>
  )
}

export default StructuredJournal
