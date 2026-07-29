# 📖 LifeLog - Online Journal System

A beautiful, modern React-based journal application for capturing your thoughts, memories, and daily experiences.

## ✨ Features

- **Create & Edit Entries**: Write journal entries with titles, content, and tags
- **File Upload**: Convert handwritten or digital photos/PDFs into journal entries with automatic text extraction (OCR)
- **Search & Filter**: Quickly find entries by searching through titles, content, or tags
- **Habit Calendar**: Visual calendar showing which days you created entries, with daily highlights
- **Date Organization**: Entries are automatically organized by creation date
- **Tag System**: Categorize entries with custom tags for better organization
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Database Storage**: All data is stored in PostgreSQL for reliable persistence
- **API Backend**: RESTful API built with Node.js and Express for robust data management
- **Modern UI**: Clean, intuitive interface with beautiful gradients and smooth animations

## 🚀 Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Run With Docker (Recommended)

Run the full stack with two containers:
- `lifelog-app` on port `3001` (frontend + API)
- `lifelog-db` on port `5001` (PostgreSQL)

```bash
docker compose up --build
```

Open `http://localhost:3001`

Database connection for local tools:
- Host: `localhost`
- Port: `5001`
- User: `lifelog`
- Password: `lifelog`
- Database: `lifelog`

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start both the backend API and frontend development server:
   ```bash
   npm run dev:full
   ```

   Or start them separately:
   ```bash
   # Terminal 1 - Start backend API
   npm run server
   
   # Terminal 2 - Start frontend
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## 📝 Usage

1. **Creating an Entry**: Click the "✏️ New Entry" button to create your first journal entry
2. **Uploading Files**: Drag and drop photos (JPG/PNG) or PDFs into the upload zone. The app will automatically extract text using OCR for images and text extraction for PDFs, creating a new entry with the extracted content
3. **Editing**: Click on any entry card to view details, then use the "✏️ Edit" button to modify
4. **Searching**: Use the search bar to find entries by keywords, tags, or content
5. **Calendar Tracking**: View the calendar to see which days you created entries. Click any date to filter entries from that day
6. **Deleting**: Open an entry and click the "🗑️ Delete" button to remove it
7. **Tags**: Add comma-separated tags to categorize your entries

## 🛠️ Tech Stack

### Frontend
- **React 19.1.0** - Modern React with hooks
- **Vite 7.0.4** - Fast build tool and development server
- **CSS3** - Custom CSS with modern features and responsive design

### Backend
- **Node.js** - JavaScript runtime for server-side development
- **Express.js** - Web framework for building the RESTful API
- **PostgreSQL** - Relational database for durable data storage
- **Tesseract.js** - OCR (Optical Character Recognition) for extracting text from images
- **PDF-Parse** - PDF text extraction for processing PDF documents
- **Multer** - Middleware for handling file uploads
- **UUID** - Unique identifier generation for entries

## 📱 Responsive Design

LifeLog is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- All modern web browsers

## 🎨 Design Features

- Beautiful gradient backgrounds
- Card-based layout for entries
- Smooth animations and transitions
- Glassmorphism effects
- Intuitive user interface
- Accessibility-friendly design

## 🔒 Data Storage

Your journal entries are stored in PostgreSQL, providing:

- **Reliability**: Data persists across browser sessions and device changes
- **Backup**: Database volume can be backed up and restored
- **Portability**: Access your entries from any device connected to the server
- **Data Integrity**: Server-side validation ensures data consistency

When running with Docker, the database is persisted in the Docker volume `lifelog_pgdata`.

## 📄 Available Scripts

- `npm run dev:full` - Start both backend API and frontend development servers
- `npm run dev` - Start frontend development server only
- `npm run server` - Start backend API server only
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🤝 Contributing

This is a personal journal application template. Feel free to fork and customize it for your own needs!

## 📧 Support

For any questions or issues, please refer to the React and Vite documentation or create an issue in the repository.
