import { tavily, TavilyClient } from '@tavily/core';

export class SerpService {
  private client: TavilyClient;

  constructor() {
    this.client = tavily({
      apiKey: process.env.TAVILY_API_KEY,
    });
  }

  async searchGoogle(query: string) {
    const response = await this.client.search(query, {
      includeImages: true,
    });

    return response.results;
  }

  async searchGoogleImages(query: string) {
    const response = await this.client.search(query, {
      includeImages: true,
      includeImageDescriptions: true,
    });

    return response.images.map((image) => ({
      url: image.url,
      description: image.description ?? 'No description available',
    }));
  }
}
