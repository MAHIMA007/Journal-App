# Memoir - AI Enhancement Roadmap

## Phase 1: Core RAG + LLM Integration

### Feature: Smart Entry Analysis & Insights
**Covers:** Embeddings, Chunking, Vector DB, Prompt Engineering, OpenAI APIs

```
User writes journal entry → Entry is split into chunks → 
Embedded using OpenAI/local model → Stored in FAISS/Chroma → 
Used for semantic search & trend analysis
```

**Implementation:**
- **Backend:** Add embedding service (`src/services/embeddingService.js`)
  - Chunk entries by paragraphs/sentences (500 token chunks)
  - Use OpenAI's `text-embedding-3-small` or local embeddings (Ollama)
  - Store vectors in PostgreSQL (pgvector extension) + FAISS for fast search

- **Features to build:**
  1. **Semantic Search** - Search entries by meaning, not just keywords
     ```javascript
     // Query: "How was I feeling about work?"
     // Finds entries about job/career/productivity even without exact words
     ```
  
  2. **Pattern Detection** - Identify recurring themes
     ```javascript
     // Analyze 30 days of entries
     // "Stress peaks on Tuesdays" or "Productivity drops after late nights"
     ```
  
  3. **AI-Generated Summaries** - Daily/weekly digests
     ```javascript
     // "This week: 3 entries about family, 5 about health, positive sentiment"
     ```

---

## Phase 2: Agentic AI & Tool Calling

### Feature: Memoir AI Coach
**Covers:** Tool Calling, Function Calling, MCP, Memory, Prompt Optimization

**Architecture:**
```
User Input → AI Agent Router → Multiple Tools → Response

Agent has access to:
- SearchTool (search past entries)
- AnalysisTool (analyze patterns)
- RecommendationTool (suggest reflections)
- GoalTrackingTool (monitor habits vs goals)
```

**Tools to implement:**

1. **Reflection Generator** (OpenAI Function Calling)
   ```javascript
   // User: "I had a tough day"
   // Agent calls: generateReflectionPrompt()
   // Response: "Based on your entry, consider: What was the trigger? 
   //           What did you learn?"
   ```

2. **Entry Classifier** (using structured outputs)
   ```javascript
   // Input: journal entry
   // Output: { mood: "stressed", themes: ["work", "health"], 
   //          actionItems: [...], suggestedTags: [...] }
   ```

3. **Cross-entry Linker**
   ```javascript
   // "This reminds me of an entry from 3 weeks ago"
   // Links related entries semantically
   ```

4. **Goal Progress Tracker**
   ```javascript
   // "You mentioned wanting to exercise more. 
   //  You've logged 12 workouts this month (up from 8 last month)"
   ```

---

## Phase 3: Advanced Memory & Context Management

### Feature: Long-term Memory System
**Covers:** Memory Management, Prompt Optimization, Context Window Management

**Implementation:**
```
Sliding Window Memory Pattern:

Recent (7 days)          → Full context sent to LLM
Medium-term (7-30 days) → Summarized version
Long-term (30+ days)    → Key facts only

Total: ~2000 tokens for full context history
```

**Components:**

1. **Memory Module** (`src/services/memoryService.js`)
   ```javascript
   class MemoryManager {
     async buildContext(entryId, daysBack = 30) {
       // Recent entries: full text
       // Past entries: summaries + key facts
       // Return as {recentContext, historicalContext}
     }
     
     async generateMemorySummary(dateRange) {
       // Compress 30 days into key bullet points
       // Extract: achievements, challenges, patterns
     }
   }
   ```

2. **Prompt Template Optimization**
   ```javascript
   // Dynamic system prompt based on what's relevant
   const systemPrompt = `
   You are a personal journal coach with this person's context:
   
   RECENT PATTERNS (past 7 days):
   ${recentSummary}
   
   HISTORICAL INSIGHTS:
   ${longTermInsights}
   
   USER GOALS:
   ${activeGoals}
   `
   ```

---

## Phase 4: RAG-Enhanced Retrieval

### Feature: Intelligent Journaling Assistant
**Covers:** LangChain/LlamaIndex, FAISS/Chroma, Chunking

**Setup LangChain Pipeline:**

```javascript
// services/ragService.js
import { OpenAIEmbeddings } from "@langchain/openai";
import { FAISS } from "@langchain/community/vectorstores/faiss";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { RetrievalQA } from "langchain/chains";

class MemoirRAG {
  async indexEntries(entries) {
    // 1. CHUNKING - Split entries intelligently
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", ". ", " "]
    });
    
    const chunks = await splitter.splitDocuments(entries);
    
    // 2. EMBEDDING - Generate vectors
    const embeddings = new OpenAIEmbeddings();
    this.vectorStore = await FAISS.fromDocuments(chunks, embeddings);
  }
  
  async queryEntries(query) {
    // Hybrid search: semantic + keyword
    const results = await this.vectorStore.similaritySearch(query, k=5);
    return results;
  }
}
```

**Use Cases:**
- "Show me entries about relationships" (semantic search)
- "What did I write about last March?" (time-based + semantic)
- "Entries where I felt stuck" (emotion-based search)

---

## Phase 5: Tool Calling & Function Definitions

### Feature: Multi-turn Conversations with Tools

```javascript
// Endpoint: /api/chat
// Uses OpenAI function_calling

const tools = [
  {
    type: "function",
    function: {
      name: "search_entries",
      description: "Search through past journal entries",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          dateRange: { type: "string", enum: ["week", "month", "year"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_sentiment",
      description: "Analyze mood/sentiment of entries",
      parameters: {
        type: "object",
        properties: {
          entries: { type: "array" },
          metric: { type: "string", enum: ["daily", "weekly", "trend"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_reflection_prompt",
      description: "Get guided reflection questions",
      parameters: {
        type: "object",
        properties: {
          focusArea: { type: "string", enum: ["emotions", "goals", "relationships", "growth"] }
        }
      }
    }
  }
];
```

---

## Phase 6: Performance & Deployment

### Vector DB Optimization
**Covers:** Cost Optimization, Caching, Monitoring

```javascript
// Smart caching strategy
class VectorDBOptimizer {
  
  async indexWithOptimization(entries) {
    // 1. Batch embeddings (reduce API calls)
    const batch = chunk(entries, 100);
    for (const batch of batches) {
      await embedBatch(batch); // Single API call for 100
    }
    
    // 2. Prune old embeddings (keep last 2 years)
    await pruneOldEntries(olderThan(2 * 365));
    
    // 3. Re-index with dimensionality reduction
    // From 1536 dims → 768 dims (trade accuracy for speed)
    await applyDimensionalityReduction();
  }
  
  async queryWithCache(query) {
    // Check cache first
    const cached = await cache.get(`query:${hash(query)}`);
    if (cached) return cached;
    
    // Otherwise query vector DB
    const results = await vectorStore.search(query);
    
    // Cache for 24 hours
    await cache.set(`query:${hash(query)}`, results, 86400);
    return results;
  }
}
```

### Redis Caching Layer
```javascript
// Cache frequently accessed data
// - Embeddings for recent entries
// - Generated summaries
// - User preferences
// - AI-generated insights

// TTL strategy:
// - Recent summaries: 1 hour
// - Analysis results: 6 hours
// - User embeddings cache: 24 hours
```

### Monitoring & Logging
```javascript
// Track key metrics
metrics: {
  "embedding_requests": count,
  "cache_hit_rate": percentage,
  "vector_search_latency": ms,
  "api_cost": dollars,
  "agent_tool_calls": distribution
}

// Log patterns for optimization
logger.info('vector_search', {
  query_length: tokens,
  results_returned: count,
  latency_ms: time,
  cache_hit: boolean
})
```

---

## Phase 7: MCP Integration & AI Autonomy

### Feature: Autonomous Journaling Assistant (MCP Basics)
**Covers:** MCP, Agents, Tool Calling

```javascript
// MCP-inspired architecture for Memoir
class MemoirMCP {
  async setupTools() {
    this.server.addTool({
      name: "read_entries",
      handler: async (params) => {
        return db.entries.find({ dateRange: params.range });
      }
    });
    
    this.server.addTool({
      name: "write_entry",
      handler: async (params) => {
        return db.entries.create(params);
      }
    });
    
    this.server.addTool({
      name: "analyze_trends",
      handler: async (params) => {
        return this.rag.analyzeTrends(params);
      }
    });
  }
  
  async runAgent(userRequest) {
    // Agent decides which tools to use
    const response = await agent.execute(userRequest, this.tools);
    return response;
  }
}
```

---

## Phase 8: Authentication & Security

### Covers: Authentication, PostgreSQL, Deployment

```javascript
// Multi-tier auth strategy
1. JWT + Refresh tokens for API
2. Row-level security in PostgreSQL
3. Encrypted embeddings in DB
4. API key rotation for OpenAI
5. Rate limiting per user

// PostgreSQL with pgvector
CREATE TABLE entries_embeddings (
  id BIGSERIAL PRIMARY KEY,
  entry_id UUID NOT NULL,
  embedding vector(1536),
  chunk_text TEXT,
  created_at TIMESTAMP,
  
  CONSTRAINT fk_entry FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE INDEX ON entries_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

## Phase 9: Deployment & DevOps

### Multi-stage Docker setup
```dockerfile
# Stage 1: Build frontend
FROM node:20 AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Stage 2: Runtime with AI services
FROM node:20
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY server ./server

# Install optional: Ollama for local embeddings
# RUN curl -fsSL https://ollama.ai/install.sh | sh

CMD ["node", "server/server.js"]
```

### Docker Compose with services:
```yaml
services:
  app: # Main app
  db: # PostgreSQL with pgvector
  redis: # Caching
  faiss: # Vector search service (optional)
  ollama: # Local LLM (optional)
  monitoring: # Prometheus + Grafana
```

---

## Implementation Priority

**MVP (Week 1-2):**
- ✅ OpenAI embeddings + FAISS indexing
- ✅ Semantic search feature
- ✅ Basic RAG retrieval

**Phase 2 (Week 3-4):**
- ✅ AI Coach with tool calling
- ✅ Pattern detection
- ✅ Daily summaries

**Phase 3+ (Week 5+):**
- Advanced memory management
- LangChain/LlamaIndex integration
- MCP protocol
- Full deployment pipeline

---

## Cost Optimization Tips

```javascript
// 1. Batch embeddings (10x cheaper)
// Instead of: entries.forEach(e => embed(e)) → $10/1000 entries
// Do: embedBatch(entries, 100) → $1/1000 entries

// 2. Use smaller embeddings model
// text-embedding-3-small: $0.02/1M tokens
// vs text-embedding-3-large: $0.13/1M tokens

// 3. Local embeddings (Ollama)
// Free! Use for non-critical features

// 4. Cache aggressively
// 80% cache hit rate = 80% cost reduction

// Monthly estimate:
// - Embeddings (100 entries/month): $0.20
// - AI Chat (50 interactions/month): $2-5
// - Vector DB queries: Free (cached)
// Total: ~$3/user/month
```

---

## Database Schema Extensions

```sql
-- Embeddings table
CREATE TABLE entry_embeddings (
  id UUID PRIMARY KEY,
  entry_id UUID NOT NULL,
  chunk_text TEXT,
  embedding vector(1536),
  chunk_index INT,
  created_at TIMESTAMP,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

-- Insights & patterns
CREATE TABLE insights (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  insight_type VARCHAR, -- 'pattern', 'trend', 'summary'
  content JSONB,
  confidence_score FLOAT,
  generated_at TIMESTAMP
);

-- Agent memory
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_type VARCHAR, -- 'context', 'preference', 'history'
  data JSONB,
  expires_at TIMESTAMP
);

-- API usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  service VARCHAR, -- 'openai', 'embedding', 'vector_search'
  tokens_used INT,
  cost_usd DECIMAL,
  timestamp TIMESTAMP
);
```

---

## Next Steps

1. **Setup Vector DB** - Add pgvector to PostgreSQL
2. **Implement Embedding Service** - Create embedding pipeline
3. **Build Semantic Search** - First user-facing feature
4. **Add AI Coach** - Implement tool calling
5. **Deploy with Monitoring** - Full production setup

Would you like me to implement Phase 1 (Core RAG + Embeddings)?
