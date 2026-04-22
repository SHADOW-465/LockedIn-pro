import db from './db';

export const DocumentService = {
  async getAll() {
    return db.rag_documents.orderBy('uploadedAt').reverse().toArray();
  },

  /**
   * Add a document. For text files, pass the extracted text in `content`.
   * For audio/binary, content should be '' (only metadata stored).
   */
  async add({ name, type, content = '', status = 'Synced' }) {
    return db.rag_documents.add({
      name,
      type,
      content,
      status,
      uploadedAt: new Date().toISOString(),
    });
  },

  async updateStatus(id, status) {
    return db.rag_documents.update(id, { status });
  },

  async delete(id) {
    return db.rag_documents.delete(id);
  },

  /**
   * Returns a single concatenated string of all text document contents.
   * Used by ChatService to inject chamber knowledge into the AI system prompt.
   */
  async getTextContent() {
    const docs = await db.rag_documents
      .where('type').equals('Transcript')
      .toArray();
    if (docs.length === 0) return '';
    return docs
      .map(d => `[Document: ${d.name}]\n${d.content}`)
      .join('\n\n---\n\n');
  },
};
