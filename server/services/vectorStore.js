import embeddingService from './embeddingService.js';

class VectorStore {
  constructor() {
    this.entries = new Map(); // Store embeddings: key = entryId, value = { content, embedding, metadata }
    this.index = []; // Array of entry IDs for ordered access
  }

  async addEntry(entryId, content, metadata = {}) {
    try {
      const embedding = await embeddingService.embed(content);
      
      this.entries.set(entryId, {
        content,
        embedding,
        metadata: {
          ...metadata,
          addedAt: new Date()
        }
      });

      if (!this.index.includes(entryId)) {
        this.index.push(entryId);
      }

      return { entryId, embedded: true };
    } catch (error) {
      console.error('Error adding entry to vector store:', error.message);
      throw error;
    }
  }

  async addEntries(entries) {
    const results = [];
    for (const entry of entries) {
      try {
        const result = await this.addEntry(
          entry.id,
          entry.content,
          entry.metadata
        );
        results.push(result);
      } catch (error) {
        console.error(`Error adding entry ${entry.id}:`, error.message);
      }
    }
    return results;
  }

  async search(query, k = 5) {
    try {
      const queryEmbedding = await embeddingService.embed(query);
      const results = [];

      // Calculate similarity for all entries
      for (const entryId of this.index) {
        const entry = this.entries.get(entryId);
        if (!entry) continue;

        const similarity = embeddingService.similarity(
          queryEmbedding,
          entry.embedding
        );

        results.push({
          entryId,
          content: entry.content,
          similarity,
          metadata: entry.metadata
        });
      }

      // Sort by similarity and return top k
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, k);
    } catch (error) {
      console.error('Error searching vector store:', error.message);
      return [];
    }
  }

  async getEntry(entryId) {
    return this.entries.get(entryId) || null;
  }

  async deleteEntry(entryId) {
    this.entries.delete(entryId);
    this.index = this.index.filter(id => id !== entryId);
    return true;
  }

  async clear() {
    this.entries.clear();
    this.index = [];
    return true;
  }

  getSize() {
    return this.entries.size;
  }

  getStats() {
    return {
      totalEntries: this.entries.size,
      embeddingDimension: embeddingService.getDimension(),
      indexedEntries: this.index.length
    };
  }
}

export default new VectorStore();
