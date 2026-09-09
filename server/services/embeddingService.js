import ollamaService from './ollamaService.js';
import crypto from 'crypto';

class EmbeddingService {
  constructor() {
    this.modelName = 'nomic-embed-text';
    this.embeddingDim = 384;
  }

  async initialize() {
    try {
      const models = await ollamaService.listModels();
      const hasModel = models.some(m => m.name.includes('nomic-embed'));
      
      if (!hasModel) {
        console.log('Pulling nomic-embed-text model...');
        await ollamaService.pullModel('nomic-embed-text');
        console.log('✅ nomic-embed-text model loaded');
      } else {
        console.log('✅ Embedding model ready');
      }
    } catch (error) {
      console.warn('Could not initialize embedding model:', error.message);
      console.log('Falling back to hash-based embeddings');
    }
  }

  async embed(text) {
    try {
      // Try to use Ollama embeddings
      return await ollamaService.embedText(text);
    } catch (error) {
      console.warn('Ollama embeddings failed, using fallback hash method:', error.message);
      // Fallback: generate deterministic embedding from text hash
      return this._hashToEmbedding(text);
    }
  }

  async embedBatch(texts) {
    const embeddings = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }

  _hashToEmbedding(text) {
    // Deterministic hash-based embedding fallback
    // Generates a consistent 384-dimensional vector
    const hash = crypto.createHash('sha256').update(text).digest();
    
    const embedding = new Array(this.embeddingDim).fill(0);
    
    for (let i = 0; i < this.embeddingDim; i++) {
      const byteIndex = i % hash.length;
      const value = hash[byteIndex] / 256; // Normalize to 0-1
      embedding[i] = value * 2 - 1; // Scale to -1 to 1
    }
    
    return embedding;
  }

  async similarity(embedding1, embedding2) {
    // Cosine similarity
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  getDimension() {
    return this.embeddingDim;
  }
}

export default new EmbeddingService();
