const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export interface TmdbResult {
  id: number;
  imageUrl: string | null;
  overview: string | null;
}

export class TmdbClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get(path: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`TMDB ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  async searchMovie(title: string, year?: number): Promise<TmdbResult | null> {
    try {
      const params: Record<string, string> = { query: title };
      if (year) params.year = String(year);

      const data = await this.get("/search/movie", params);
      const result = data.results?.[0];
      if (!result) return null;

      return {
        id: result.id,
        imageUrl: result.poster_path ? `${IMAGE_BASE}${result.poster_path}` : null,
        overview: result.overview || null,
      };
    } catch (err) {
      console.error("[tmdb] searchMovie failed:", err);
      return null;
    }
  }

  async searchTv(title: string): Promise<TmdbResult | null> {
    try {
      const data = await this.get("/search/tv", { query: title });
      const result = data.results?.[0];
      if (!result) return null;

      return {
        id: result.id,
        imageUrl: result.poster_path ? `${IMAGE_BASE}${result.poster_path}` : null,
        overview: result.overview || null,
      };
    } catch (err) {
      console.error("[tmdb] searchTv failed:", err);
      return null;
    }
  }

  async getEpisode(
    tvId: number,
    season: number,
    episode: number
  ): Promise<TmdbResult | null> {
    try {
      const data = await this.get(`/tv/${tvId}/season/${season}/episode/${episode}`);
      return {
        id: data.id,
        imageUrl: data.still_path ? `${IMAGE_BASE}${data.still_path}` : null,
        overview: data.overview || null,
      };
    } catch (err) {
      console.error("[tmdb] getEpisode failed:", err);
      return null;
    }
  }
}
