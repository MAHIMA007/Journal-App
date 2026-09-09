import vectorStore from './vectorStore.js';
import ollamaService from './ollamaService.js';

class RAGService {
  constructor() {
    this.chunkSize = 500;
    this.chunkOverlap = 100;
  }

  async indexEntry(entry) {
    try {
      // Split entry into chunks
      const chunks = this.chunkText(entry.content);

      // Add all chunks to vector store
      const chunkMetadata = chunks.map((chunk, idx) => ({
        id: `${entry.id}_chunk_${idx}`,
        content: chunk,
        metadata: {
          entryId: entry.id,
          chunkIndex: idx,
          totalChunks: chunks.length,
          entryTitle: entry.title,
          entryDate: entry.createdAt,
          entryTags: entry.tags
        }
      }));

      const results = await vectorStore.addEntries(chunkMetadata);
      console.log(`✅ Indexed entry ${entry.id} with ${chunks.length} chunks`);
      return results;
    } catch (error) {
      console.error('Error indexing entry:', error.message);
      throw error;
    }
  }

  async indexEntries(entries) {
    const results = [];
    for (const entry of entries) {
      try {
        const result = await this.indexEntry(entry);
        results.push(...result);
      } catch (error) {
        console.error(`Failed to index entry ${entry.id}:`, error.message);
      }
    }
    return results;
  }

  chunkText(text, chunkSize = this.chunkSize, overlap = this.chunkOverlap) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    let currentChunk = '';
    let currentTokenCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/);
      const sentenceTokens = sentenceWords.length;

      if (currentTokenCount + sentenceTokens > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Add overlap by including last few sentences
        const words = currentChunk.split(/\s+/);
        const overlapWords = Math.min(overlap, Math.floor(words.length / 2));
        currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence.trim();
        currentTokenCount = currentChunk.split(/\s+/).length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
        currentTokenCount += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text]; // Return original if no chunks
  }

  async semanticSearch(query, k = 5) {
    try {
      const results = await vectorStore.search(query, k);

      return results.map(result => ({
        text: result.content,
        entryId: result.metadata.entryId,
        date: result.metadata.entryDate,
        title: result.metadata.entryTitle,
        similarity: result.similarity,
        chunkIndex: result.metadata.chunkIndex
      }));
    } catch (error) {
      console.error('Error in semantic search:', error.message);
      return [];
    }
  }

  async queryWithRAG(query, k = 5, temperature = 0.7) {
    try {
      // 1. Retrieve relevant entries from vector store
      const context = await this.semanticSearch(query, k);

      if (context.length === 0) {
        // No context found, respond based on query alone
        const response = await ollamaService.generateResponse(
          `User query: ${query}\n\nRespond helpfully as a journal AI coach.`,
          '',
          temperature
        );

        return {
          answer: response,
          sources: [],
          hasContext: false
        };
      }

      // 2. Format context for LLM
      const contextText = context
        .map(c => `[${c.date || 'Unknown date'}] ${c.title || 'Entry'}\n${c.text}`)
        .join('\n\n---\n\n');

      // 3. Create system prompt
      const systemPrompt = `You are a thoughtful and empathetic journal AI coach.
Your role is to help users reflect on their journal entries and provide personalized insights.
Be warm, supportive, and help them discover patterns and growth opportunities.
Reference specific details from their past entries when relevant.`;

      // 4. Create final prompt
      const finalPrompt = `Based on these past journal entries:

${contextText}

---

User question or request: ${query}

Provide a helpful, empathetic, and personalized response. 
Reference specific details from their journal when appropriate.`;

      // 5. Generate response using LLM
      const answer = await ollamaService.generateResponse(finalPrompt, systemPrompt, temperature);

      return {
        answer,
        sources: context.slice(0, 3), // Top 3 sources
        hasContext: true,
        contextCount: context.length
      };
    } catch (error) {
      console.error('Error in RAG query:', error.message);
      throw error;
    }
  }

  getStats() {
    return vectorStore.getStats();
  }

  async clearIndex() {
    return vectorStore.clear();
  }
}

export default new RAGService();
