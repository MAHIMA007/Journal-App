import { useState, useRef } from 'react'
import './FileUpload.css'

function FileUpload({ onUpload }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [drafts, setDrafts] = useState([])
  const fileInputRef = useRef(null)

  const handleFiles = async (files) => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)

    const formData = new FormData()
    for (let file of files) {
      formData.append('files', file)
    }

    try {
      const response = await fetch('/api/entries/extract', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      setDrafts(result.drafts || [])
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Upload error:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleChange = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const updateDraft = (index, field, value) => {
    setDrafts((prevDrafts) =>
      prevDrafts.map((draft, i) =>
        i === index ? { ...draft, [field]: value } : draft
      )
    )
  }

  const removeDraft = (index) => {
    setDrafts((prevDrafts) => prevDrafts.filter((_, i) => i !== index))
  }

  const clearDrafts = () => {
    setDrafts([])
  }

  const handleSaveDrafts = async () => {
    if (drafts.length === 0) return

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/entries/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ drafts })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save entries')
      }

      const result = await response.json()
      onUpload(result.entries || [])
      setDrafts([])
    } catch (saveError) {
      console.error('Import error:', saveError)
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="file-upload-container">
      <div
        className={`file-upload-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="file-upload-content">
          <span className="file-upload-icon">📤</span>
          <h3>Upload Journal from Files</h3>
          <p>Drag and drop files here</p>
          <p className="file-upload-hint">Supports JPG, PNG, PDF, TXT, RTF, and Word documents (.docx, .doc)</p>
          <button
            type="button"
            className="file-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isSaving}
          >
            {isLoading ? 'Extracting...' : 'Choose Files'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf,text/plain,text/rtf,application/rtf,application/x-rtf,.rtf,.docx,.doc,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="draft-preview">
          <div className="draft-preview-header">
            <h4>Review extracted entries ({drafts.length})</h4>
            <p>Edit before saving to your journal.</p>
          </div>

          <div className="draft-list">
            {drafts.map((draft, index) => (
              <div key={`${draft.title}-${index}`} className="draft-card">
                <div className="draft-card-header">
                  <label htmlFor={`draft-title-${index}`}>Title</label>
                  <button
                    type="button"
                    className="draft-remove-btn"
                    onClick={() => removeDraft(index)}
                    aria-label="Remove extracted draft"
                  >
                    Remove
                  </button>
                </div>

                <input
                  id={`draft-title-${index}`}
                  type="text"
                  value={draft.title}
                  onChange={(e) => updateDraft(index, 'title', e.target.value)}
                  className="draft-input"
                />

                <label htmlFor={`draft-content-${index}`}>Content</label>
                <textarea
                  id={`draft-content-${index}`}
                  value={draft.content}
                  onChange={(e) => updateDraft(index, 'content', e.target.value)}
                  className="draft-textarea"
                  rows="8"
                />
              </div>
            ))}
          </div>

          <div className="draft-actions">
            <button type="button" className="draft-cancel-btn" onClick={clearDrafts} disabled={isSaving}>
              Cancel
            </button>
            <button type="button" className="draft-save-btn" onClick={handleSaveDrafts} disabled={isSaving || drafts.length === 0}>
              {isSaving ? 'Saving...' : 'Save All Entries'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="file-upload-error">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)} className="error-close">✕</button>
        </div>
      )}
    </div>
  )
}

export default FileUpload
