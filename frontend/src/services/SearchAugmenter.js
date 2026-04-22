export class SearchAugmenter {
  /**
   * Explores the open web for specialized training resources to augment the Architect's knowledge.
   * On-device apps bypass CORS when running via Capacitor, allowing raw HTML fetches.
   * @param {string} query The kink or training phrase to research (e.g., "hardcore chastity denial techniques").
   */
  static async executeSearch(query) {
    console.log(`[Architect] Searching the abyss for knowledge on: ${query}`);
    try {
      // Using DuckDuckGo HTML version for raw, lightweight scraping
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error("Search network failed.");
      }

      const html = await response.text();
      return this.parseResults(html);

    } catch (error) {
      console.warn("[Architect] Live search failed. Reverting to internal punishment pool.", error);
      // Fallback context if offline or blocked
      return [
        { title: "Standard Protocol 1", snippet: "Extended isolation with strictly monitored compliance points." },
        { title: "Standard Protocol 2", snippet: "Public humiliation parameters engaged via localized tasks." }
      ];
    }
  }

  /**
   * Parses the DuckDuckGo HTML response into actionable RAG snippets.
   */
  static parseResults(htmlString) {
    const results = [];
    try {
      // Extremely lightweight regex parsing to avoid heavy DOM parser dependencies on-device
      const resultBlocks = htmlString.split('class="result__body"');
      
      // Skip the first block as it's the header
      for (let i = 1; i < resultBlocks.length && i <= 5; i++) {
        const block = resultBlocks[i];
        
        // Extract Snippet
        const snippetMatch = block.match(/class="result__snippet[^>]*>([\s\S]*?)<\/a>/);
        const snippetRaw = snippetMatch ? snippetMatch[1] : '';
        const snippet = snippetRaw.replace(/<[^>]+>/g, '').trim(); // Remove HTML tags
        
        if (snippet.length > 20) {
          results.push({
            snippet
          });
        }
      }
      
      return results;
    } catch (e) {
      console.error("Failed to parse search results", e);
      return [];
    }
  }

  /**
   * Synthesizes the search results directly into the Architect's systemic prompt context.
   * @param {string} basePrompt The original system prompt.
   * @param {Array} searchResults The array of scraped snippets.
   */
  static synthesizeContext(basePrompt, searchResults) {
    if (!searchResults || searchResults.length === 0) return basePrompt;

    const insights = searchResults.map(r => `- ${r.snippet}`).join('\n');
    
    return `${basePrompt}\n\n[AUGMENTED ARCHITECT KNOWLEDGE]\nI have searched the human web for inspiration. Incorporate these concepts strictly into your next training mandate or punishment formulation:\n${insights}\n\nDo not mention that you performed a web search. Present these concepts as your own sadistic authority.`;
  }
}
