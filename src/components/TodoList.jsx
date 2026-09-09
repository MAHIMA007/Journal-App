import { useState, useEffect } from 'react'
import './TodoList.css'
import { matchCareItemId, setCareDate } from '../utils/careTracker'
import { matchHabitId, setHabitDate } from '../utils/habitTracker'
import { TODO_SYNC_EVENT, loadTodos, saveTodos, syncTodosFromServer } from '../utils/todoStore'
import { toDateString } from '../utils/dateUtils'

function TodoList() {
  const [todos, setTodos] = useState(() => loadTodos())
  const [newTodo, setNewTodo] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Pull the latest list from the server on mount (e.g. added on another device).
  useEffect(() => {
    syncTodosFromServer()
    const refresh = () => setTodos(loadTodos())
    window.addEventListener(TODO_SYNC_EVENT, refresh)
    return () => window.removeEventListener(TODO_SYNC_EVENT, refresh)
  }, [])

  const addTodo = (event) => {
    event.preventDefault()
    const text = newTodo.trim()
    if (!text) return
    const nextTodos = [...todos, { id: Date.now(), text, completed: false }]
    setTodos(nextTodos)
    saveTodos(nextTodos)
    setNewTodo('')
  }

  const toggleTodo = (todoId) => {
    let toggled = null
    const nextTodos = todos.map((todo) => {
      if (todo.id !== todoId) return todo
      toggled = { ...todo, completed: !todo.completed }
      return toggled
    })
    setTodos(nextTodos)
    saveTodos(nextTodos)

    // Checking off a recognized task (e.g. "hairwash") auto-logs it on the calendar and/or habit tracker.
    if (toggled) {
      const todayKey = toDateString(new Date())
      const careItemId = matchCareItemId(toggled.text)
      if (careItemId) {
        setCareDate(careItemId, todayKey, toggled.completed)
      }
      const habitId = matchHabitId(toggled.text)
      if (habitId) {
        setHabitDate(habitId, todayKey, toggled.completed)
      }
    }
  }

  const startEdit = (todo) => {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  const saveEdit = (todoId) => {
    const text = editingText.trim()
    if (text) {
      const nextTodos = todos.map((todo) => (
        todo.id === todoId ? { ...todo, text } : todo
      ))
      setTodos(nextTodos)
      saveTodos(nextTodos)
    }
    cancelEdit()
  }

  const removeTodo = (todoId) => {
    const nextTodos = todos.filter((todo) => todo.id !== todoId)
    setTodos(nextTodos)
    saveTodos(nextTodos)
  }

  const visibleTodos = todos.filter((todo) => (
    todo.text.toLowerCase().includes(searchQuery.trim().toLowerCase())
  ))

  return (
    <div className="todo-widget">
      <div className="todo-widget-header">
        <span className="todo-count">{todos.filter((todo) => todo.completed).length}/{todos.length} done</span>
      </div>

      {todos.length > 0 && (
        <input
          className="todo-search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search tasks"
          aria-label="Search tasks"
          type="search"
        />
      )}

      {visibleTodos.length > 0 ? (
        <div className="todo-items">
          {visibleTodos.map((todo) => (
            <div className={`todo-item ${todo.completed ? 'is-complete' : ''}`} key={todo.id}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                aria-label={`Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`}
              />
              {editingId === todo.id ? (
                <input
                  className="todo-edit-input"
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      saveEdit(todo.id)
                    } else if (event.key === 'Escape') {
                      cancelEdit()
                    }
                  }}
                  onBlur={() => saveEdit(todo.id)}
                  aria-label="Edit task"
                  autoFocus
                />
              ) : (
                <span onDoubleClick={() => startEdit(todo)}>{todo.text}</span>
              )}
              <button
                type="button"
                className="todo-edit-btn"
                onClick={() => (editingId === todo.id ? saveEdit(todo.id) : startEdit(todo))}
                aria-label={editingId === todo.id ? 'Save task' : `Edit "${todo.text}"`}
              >
                {editingId === todo.id ? '✓' : '✎'}
              </button>
              <button
                type="button"
                className="todo-remove-btn"
                onClick={() => removeTodo(todo.id)}
                aria-label={`Delete "${todo.text}"`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        todos.length > 0 && <p className="todo-no-results">No tasks match "{searchQuery}".</p>
      )}

      <form className="todo-form" onSubmit={addTodo}>
        <input
          value={newTodo}
          onChange={(event) => setNewTodo(event.target.value)}
          placeholder="Add a task"
          aria-label="Add a daily task"
        />
        <button type="submit">Add</button>
      </form>
    </div>
  )
}

export default TodoList
