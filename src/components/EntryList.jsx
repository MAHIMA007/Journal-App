import './EntryList.css'

function EntryList({ entries, onSelectEntry }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const truncateContent = (content, maxLength = 120) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <h3>No entries found</h3>
        <p>Start writing your first journal entry or try a different search term.</p>
      </div>
    )
  }

  return (
    <div className="entry-list">
      <div className="entry-count">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
      </div>
      
      <div className="entries-grid">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="entry-card"
            onClick={() => onSelectEntry(entry)}
          >
            <div className="entry-card-header">
              <h3 className="entry-card-title">{entry.title}</h3>
              <div className="entry-card-meta">
                <span className="entry-card-date">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            </div>
            
            <p className="entry-card-content">
              {truncateContent(entry.content)}
            </p>
            
            {entry.tags && entry.tags.length > 0 && (
              <div className="entry-card-tags">
                {entry.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="entry-card-tag">
                    #{tag}
                  </span>
                ))}
                {entry.tags.length > 3 && (
                  <span className="entry-card-tag-more">
                    +{entry.tags.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default EntryList
