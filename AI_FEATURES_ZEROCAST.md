# Memoir - Zero-Cost AI Implementation

> All features implemented with **100% open-source, self-hosted tools**. No API costs ever.

## Free Architecture Stack

| Feature | Paid Alternative | Free Solution | Savings |
|---------|------------------|----------------|---------|
| LLM | OpenAI ($0.15/1K tokens) | Ollama + Llama 2 (free) | ∞ |
| Embeddings | OpenAI ($0.02/1M tokens) | Hugging Face (free) | ∞ |
| Vector DB | Pinecone ($0.25/1M vectors) | FAISS/Chroma (free) | ∞ |
| Database | N/A | PostgreSQL + pgvector (free) | - |
| RAG | LangChain Cloud | LangChain OSS (free) | ∞ |
| Caching | N/A | Redis (free) | - |
| Monitoring | DataDog ($$$) | Prometheus + Grafana (free) | ∞ |
| **Total** | ~$500/month | **$0** | 100% savings |

---

## 🚀 Phase 1: Local Embeddings + FAISS (This Week)

### Setup Ollama (free local LLM)
```bash
# Install Ollama from ollama.ai
# Or use Docker:
docker run -d -v ollama:/root/.ollama -p 11434:11434 ollama/ollama

# Pull a free model
ollama pull mistral  # Fast, 7B params
ollama pull neural-chat  # Good for conversations
ollama pull nomic-embed-text  # Free embeddings!
```

### Install local embedding model
```bash
npm install @xenova/transformers  # Hugging Face transformers in Node.js
# Or: ollama pull nomic-embed-text (1.3GB)
```

### Database Setup (PostgreSQL + pgvector)
```bash
# PostgreSQL with pgvector support (Docker)
docker run -d \
  -e POSTGRES_PASSWORD=memoir \
  -e POSTGRES_DB=memoir \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Then run SQL migration
psql -d memoir -f setup-pgvector.sql
```

---

## Implementation Plan

### Week 1: Core RAG Pipeline
```
Entry Created → Chunked → Embedded (local) → Stored in FAISS/PG → Indexed
```

### Week 2: AI Agent
```
User Input → Ollama LLM → Tool calls → Search FAISS → Generate response
```

### Week 3: Advanced Features
```
Pattern detection, Summaries, Memory management, Monitoring
```

---

## Detailed Implementation

### 1️⃣ Embedding Service (Free)

```javascript
// src/services/embeddingService.js
import { pipeline } from "@xenova/transformers";

class FreeEmbeddingService {
  constructor() {
    this.extractor = null;
  }

  async initialize() {
    // Initialize Hugging Face transformers (runs locally)
    this.extractor = await pipeline(
      'feature-extraction',
      'Xenova/nomic-embed-text-v1.5'
    );
    console.log("✅ Local embedding model loaded");
  }

  async embed(text) {
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data);
  }

  async embedBatch(texts) {
    // Batch for efficiency
    return Promise.all(texts.map(text => this.embed(text)));
  }
}

export default new FreeEmbeddingService();
```

### 2️⃣ Vector Store (FAISS)

```javascript
// src/services/vectorStore.js
import { FAISS } from "@langchain/community/vectorstores/faiss";
import embeddings from './embeddingService';
import { Document } from "langchain/document";

class MemoirVectorStore {
  async initialize() {
    this.store = null;
  }

  async addEntries(entries) {
    const docs = entries.map(entry => new Document({
      pageContent: entry.content,
      metadata: {
        entryId: entry.id,
        date: entry.createdAt,
        title: entry.title,
        tags: entry.tags
      }
    }));

    if (!this.store) {
      // Create new FAISS store
      this.store = await FAISS.fromDocuments(
        docs,
        embeddings
      );
    } else {
      // Add to existing store
      await this.store.addDocuments(docs);
    }

    // Persist to disk (survives restart)
    await this.store.save('./data/faiss_store');
    console.log(`✅ Indexed ${docs.length} entries`);
  }

  async search(query, k = 5) {
    const results = await this.store.similaritySearch(query, k);
    return results;
  }

  async loadFromDisk() {
    if (fs.existsSync('./data/faiss_store')) {
      this.store = await FAISS.load(
        './data/faiss_store',
        embeddings
      );
      console.log("✅ Loaded vector store from disk");
    }
  }
}

export default new MemoirVectorStore();
```

### 3️⃣ Local LLM Service (Ollama)

```javascript
// src/services/ollamaService.js
import axios from 'axios';

class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434/api';
    this.model = 'mistral'; // Fast 7B model
  }

  async generateResponse(prompt, context = '') {
    try {
      const response = await axios.post(
        `${this.baseURL}/generate`,
        {
          model: this.model,
          prompt: `${context}\n\n${prompt}`,
          stream: false,
          temperature: 0.7,
          top_p: 0.9
        }
      );
      return response.data.response;
    } catch (error) {
      console.error('Ollama error:', error.message);
      return "Ollama service not running. Run: docker run -p 11434:11434 ollama/ollama";
    }
  }

  async chat(messages, systemPrompt = '') {
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    return this.generateResponse(prompt, systemPrompt);
  }

  async embedText(text) {
    // Alternative: use Ollama's embedding endpoint
    const response = await axios.post(
      `${this.baseURL}/embed`,
      {
        model: 'nomic-embed-text',
        input: text
      }
    );
    return response.data.embedding;
  }
}

export default new OllamaService();
```

### 4️⃣ RAG Pipeline

```javascript
// src/services/ragService.js
import vectorStore from './vectorStore';
import ollama from './ollamaService';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

class MemoirRAG {
  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", ". ", " "]
    });
  }

  async indexEntry(entry) {
    // 1. Chunk the entry
    const chunks = await this.splitter.splitText(entry.content);
    
    // 2. Add to vector store
    const docs = chunks.map(chunk => ({
      pageContent: chunk,
      metadata: {
        entryId: entry.id,
        date: entry.date,
        title: entry.title
      }
    }));
    
    await vectorStore.addEntries(docs);
  }

  async semanticSearch(query, k = 5) {
    // Search vector store
    const results = await vectorStore.search(query, k);
    return results.map(doc => ({
      text: doc.pageContent,
      entryId: doc.metadata.entryId,
      date: doc.metadata.date,
      similarity: doc.metadata.similarity
    }));
  }

  async queryWithRAG(query) {
    // 1. Retrieve relevant entries
    const context = await this.semanticSearch(query);
    const contextText = context
      .map(c => `[${c.date}] ${c.text}`)
      .join('\n---\n');

    // 2. Generate response using context
    const systemPrompt = `You are a thoughtful journal AI coach. 
    Use the user's past journal entries to provide personalized insights.`;

    const prompt = `
Context from past entries:
${contextText}

User question: ${query}

Provide a helpful, empathetic response based on their journal history.`;

    const response = await ollama.generateResponse(prompt, systemPrompt);
    return {
      answer: response,
      sources: context.slice(0, 3)
    };
  }
}

export default new MemoirRAG();
```

### 5️⃣ AI Agent with Tool Calling

```javascript
// src/services/agentService.js
import rag from './ragService';
import ollama from './ollamaService';

class MemoirAgent {
  constructor() {
    this.tools = {
      search_entries: this.searchEntries.bind(this),
      analyze_mood: this.analyzeMood.bind(this),
      find_patterns: this.findPatterns.bind(this),
      generate_insights: this.generateInsights.bind(this)
    };
  }

  async searchEntries(query) {
    return rag.semanticSearch(query);
  }

  async analyzeMood(entries) {
    // Simple sentiment analysis (can upgrade to local model)
    const prompt = `Analyze the mood in these journal entries:
${entries.map(e => e.text).join('\n---\n')}

Provide: overall sentiment, key emotions, trends`;

    return ollama.generateResponse(prompt);
  }

  async findPatterns(entries) {
    const prompt = `Analyze these journal entries for patterns:
${entries.map(e => e.text).join('\n---\n')}

Find recurring themes, triggers, and behavioral patterns.`;

    return ollama.generateResponse(prompt);
  }

  async generateInsights(entries) {
    const prompt = `Generate personalized insights from these journals:
${entries.map(e => e.text).join('\n---\n')}

Provide 3-5 actionable insights and growth opportunities.`;

    return ollama.generateResponse(prompt);
  }

  async execute(userQuery, recentEntries) {
    // Multi-step agent reasoning
    const systemPrompt = `You are an intelligent journal assistant.
    
Available tools:
- search_entries(query): Search journal history
- analyze_mood(entries): Analyze emotional patterns
- find_patterns(entries): Find recurring themes
- generate_insights(entries): Generate growth insights

Respond with a thoughtful, personalized response.`;

    // Decide which tools to use
    const toolsToUse = this.decideTool(userQuery);
    
    // Execute tools
    const results = {};
    for (const tool of toolsToUse) {
      results[tool] = await this.tools[tool](recentEntries);
    }

    // Generate final response
    const response = await ollama.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
        { role: 'assistant', content: JSON.stringify(results) }
      ]
    );

    return response;
  }

  decideTool(query) {
    // Simple heuristic for tool selection
    const query_lower = query.toLowerCase();
    const tools = [];

    if (query_lower.includes('search') || query_lower.includes('find')) {
      tools.push('search_entries');
    }
    if (query_lower.includes('mood') || query_lower.includes('feel')) {
      tools.push('analyze_mood');
    }
    if (query_lower.includes('pattern') || query_lower.includes('trend')) {
      tools.push('find_patterns');
    }
    if (query_lower.includes('insight') || query_lower.includes('suggest')) {
      tools.push('generate_insights');
    }

    return tools.length > 0 ? tools : ['search_entries'];
  }
}

export default new MemoirAgent();
```

### 6️⃣ PostgreSQL Schema (pgvector)

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Entry embeddings table
CREATE TABLE entry_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(384),  -- Nomic embed size
  chunk_index INT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Index for fast vector search
CREATE INDEX ON entry_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Store AI insights
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  insight_type VARCHAR(50),  -- 'pattern', 'mood_trend', 'summary'
  content TEXT,
  generated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Agent conversation history
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  query TEXT,
  response TEXT,
  tools_used VARCHAR[],
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Usage tracking (for monitoring, not cost)
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature VARCHAR(50),  -- 'search', 'analysis', 'generation'
  processing_time_ms INT,
  tokens_processed INT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 📦 Docker Compose (All Free)

```yaml
version: '3.8'

services:
  # PostgreSQL with pgvector
  db:
    image: pgvector/pgvector:pg16
    container_name: memoir-db
    environment:
      POSTGRES_USER: memoir
      POSTGRES_PASSWORD: memoir_secure_pw
      POSTGRES_DB: memoir
    ports:
      - "5432:5432"
    volumes:
      - memoir_pgdata:/var/lib/postgresql/data
      - ./setup-pgvector.sql:/docker-entrypoint-initdb.d/01-pgvector.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memoir"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Ollama LLM engine
  ollama:
    image: ollama/ollama
    container_name: memoir-ollama
    ports:
      - "11434:11434"
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    volumes:
      - ollama_data:/root/.ollama
    # Pre-load models on startup (optional)
    entrypoint: ["sh", "-c", "ollama serve & sleep 2 && ollama pull mistral && ollama pull nomic-embed-text && wait"]

  # Redis cache (optional but recommended)
  redis:
    image: redis:7-alpine
    container_name: memoir-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Node.js backend + frontend
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: memoir-app
    depends_on:
      db:
        condition: service_healthy
      ollama:
        condition: service_started
    environment:
      DB_HOST: db
      DB_USER: memoir
      DB_PASSWORD: memoir_secure_pw
      DB_NAME: memoir
      OLLAMA_URL: http://ollama:11434
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    ports:
      - "5173:5173"
      - "3001:3001"
    volumes:
      - ./src:/app/src
      - ./server:/app/server
    command: npm run dev:full

volumes:
  memoir_pgdata:
  ollama_data:
  redis_data:
```

---

## 🎯 Implementation Checklist

### Week 1: Core Setup
- [ ] Install Ollama and pull models
- [ ] Setup PostgreSQL + pgvector
- [ ] Implement embedding service (Xenova)
- [ ] Create vector store (FAISS)
- [ ] Build semantic search API

### Week 2: AI Agent
- [ ] Implement Ollama integration
- [ ] Build RAG pipeline
- [ ] Create agent with tool calling
- [ ] Add conversation history
- [ ] Build chat UI

### Week 3: Advanced Features
- [ ] Pattern detection
- [ ] Daily summaries (scheduled)
- [ ] Mood trend analysis
- [ ] Caching layer (Redis)
- [ ] Monitoring dashboard

### Week 4: Polish & Deploy
- [ ] Fine-tune model responses
- [ ] Optimize performance
- [ ] Docker Compose setup
- [ ] Deploy to server
- [ ] End-to-end testing

---

## 💡 Performance Tips (Still Free!)

### 1. Optimize Embeddings
```javascript
// Use smaller model for speed
// Xenova/nomic-embed-text-v1.5 (384 dims, fast)
// vs larger models (1536+ dims, slower)
```

### 2. Smart Chunking
```javascript
// Break entries intelligently:
// - By paragraph (semantic units)
// - Max 500 tokens
// - 100 token overlap for context
```

### 3. Batch Operations
```javascript
// Process multiple entries together
// Reindex nightly when load is low
```

### 4. Redis Caching
```javascript
// Cache frequent queries
// TTL: 24 hours for embeddings
// TTL: 1 hour for generated insights
```

### 5. FAISS Optimization
```javascript
// Use IVF index for large datasets (1000+ docs)
// Train index on sample data
```

---

## Example Usage

```javascript
// Endpoint: POST /api/ai/chat
async function handleAIChat(req, res) {
  const { message, userId } = req.body;
  
  // Get recent entries for context
  const recentEntries = await db.entries.find(
    { userId },
    { sort: { createdAt: -1 }, limit: 20 }
  );
  
  // Run agent
  const response = await agent.execute(message, recentEntries);
  
  // Save to history
  await db.aiConversations.create({
    userId,
    query: message,
    response: response.answer,
    sources: response.sources
  });
  
  res.json({ response, sources: response.sources });
}
```

---

## Cost Breakdown (Actual)

| Component | Cost |
|-----------|------|
| PostgreSQL | Free (self-hosted) |
| Ollama | Free |
| FAISS | Free |
| Redis | Free |
| Xenova Embeddings | Free (runs locally) |
| **Total** | **$0** |

---

## What You Get (100% Free)

✅ Semantic search over journal entries
✅ Multi-turn AI conversations
✅ Pattern & mood detection
✅ Personalized insights
✅ Daily summaries
✅ Goal tracking with AI
✅ Unlimited queries
✅ Full data ownership (self-hosted)
✅ No vendor lock-in
✅ Privacy (everything stays on your server)

---

## Next Steps

1. **Install Ollama**: `brew install ollama` or Docker
2. **Pull models**: `ollama pull mistral nomic-embed-text`
3. **Setup PostgreSQL + pgvector**
4. **Implement embedding service**
5. **Build RAG pipeline**
6. **Deploy Docker Compose**

Ready to start?
