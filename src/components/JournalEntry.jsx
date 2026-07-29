import { useState } from 'react'
import EntryForm from './EntryForm'
import './JournalEntry.css'

function JournalEntry({ entry, onUpdate, onDelete, onBack }) {
  const [isEditing, setIsEditing] = useState(false)

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleUpdate = (updatedData) => {
    onUpdate(entry.id, updatedData)
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      onDelete(entry.id)
    }
  }

  if (isEditing) {
    return (
      <EntryForm
        entry={entry}
        onSave={handleUpdate}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  return (
    <div className="journal-entry">
      <div className="entry-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to entries
        </button>
        <div className="entry-actions">
          <button className="edit-btn" onClick={() => setIsEditing(true)}>
            ✏️ Edit
          </button>
          <button className="delete-btn" onClick={handleDelete}>
            🗑️ Delete
          </button>
        </div>
      </div>

      <div className="entry-content">
        <div className="entry-meta">
          <h1 className="entry-title">{entry.title}</h1>
          <div className="entry-info">
            <span className="entry-date">
              📅 {formatDate(entry.createdAt)}
            </span>
          </div>
          {entry.updatedAt !== entry.createdAt && (
            <p className="entry-updated">
              Last updated: {formatDate(entry.updatedAt)}
            </p>
          )}
        </div>

        {entry.tags && entry.tags.length > 0 && (
          <div className="entry-tags">
            {entry.tags.map((tag, index) => (
              <span key={index} className="tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="entry-body">
          {entry.content.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default JournalEntry
