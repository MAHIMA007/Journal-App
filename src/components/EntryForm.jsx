import { useState } from 'react'
import './EntryForm.css'

function EntryForm({ entry, onSave, onCancel }) {
  const [title, setTitle] = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [tags, setTags] = useState(entry?.tags?.join(', ') || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    const entryData = {
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag)
    }

    onSave(entryData)
  }

  return (
    <div className="entry-form-container">
      <div className="entry-form-header">
        <h2>{entry ? 'Edit Entry' : 'New Journal Entry'}</h2>
        <button className="cancel-btn" onClick={onCancel}>✕</button>
      </div>

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's on your mind?"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tags">Tags</label>
          <input
            type="text"
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="work, personal, travel (comma separated)"
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thoughts here..."
            rows="12"
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="save-btn">
            {entry ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EntryForm
