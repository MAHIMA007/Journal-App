import { useState, useRef, useEffect } from 'react'
import './AIChatPanel.css'

function AIChatPanel({ username = 'default' }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: "Hello! I'm your Memoir AI coach. Ask me anything about your journal entries or share your thoughts. I can help you find patterns, analyze your mood, or provide personalized insights.",
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e) => {
    e.preventDefault()

    if (!inputValue.trim()) return

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: inputValue,
          userId: username
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const aiMessage = {
        id: messages.length + 2,
        type: 'ai',
        content: data.response,
        sources: data.sources || [],
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (err) {
      setError(err.message)
      const errorMessage = {
        id: messages.length + 2,
        type: 'ai',
        content: `Sorry, I encountered an error: ${err.message}. Please make sure Ollama is running on your system.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = async (action) => {
    const prompts = {
      mood: "What's my overall mood trend based on my recent entries?",
      patterns: "What patterns do you notice in my journal entries?",
      insights: "What insights can you share about my personal growth?",
      goals: "How am I progressing toward my goals?"
    }

    setInputValue(prompts[action])
  }

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <h2>🤖 Memoir AI Coach</h2>
        <p>Personalized insights from your journal entries</p>
      </div>

      <div className="ai-chat-messages">
        {messages.map(message => (
          <div key={message.id} className={`ai-message ai-message-${message.type}`}>
            <div className="ai-message-content">
              {message.type === 'ai' && <span className="ai-icon">🧠</span>}
              {message.type === 'user' && <span className="ai-icon">👤</span>}
              <div className="ai-message-text">
                <p>{message.content}</p>
                {message.sources && message.sources.length > 0 && (
                  <div className="ai-sources">
                    <p className="sources-label">Sources:</p>
                    {message.sources.map((source, idx) => (
                      <div key={idx} className="source-item">
                        <small>
                          📔 {source.title} ({source.date})
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <small className="ai-message-time">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </small>
          </div>
        ))}
        {loading && (
          <div className="ai-message ai-message-ai">
            <div className="ai-message-content">
              <span className="ai-icon">🧠</span>
              <div className="ai-loading">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="ai-error">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="ai-quick-actions">
        <button onClick={() => handleQuickAction('mood')} className="quick-btn">
          📊 Analyze Mood
        </button>
        <button onClick={() => handleQuickAction('patterns')} className="quick-btn">
          🔄 Find Patterns
        </button>
        <button onClick={() => handleQuickAction('insights')} className="quick-btn">
          💡 Generate Insights
        </button>
        <button onClick={() => handleQuickAction('goals')} className="quick-btn">
          🎯 Track Goals
        </button>
      </div>

      <form onSubmit={handleSendMessage} className="ai-chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Ask me about your journal, patterns, or get insights..."
          className="ai-chat-input"
          disabled={loading}
        />
        <button type="submit" className="ai-chat-send-btn" disabled={loading || !inputValue.trim()}>
          {loading ? '⏳' : '→'}
        </button>
      </form>
    </div>
  )
}

export default AIChatPanel
