import { XMLParser } from "fast-xml-parser";

export class PlexClient {
  private baseUrl: string;
  private token: string;
  private parser: XMLParser;

  constructor(opts: { baseUrl: string; token: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true
    });
  }

  private withToken(path: string): string {
    const url = new URL(this.baseUrl + path);
    url.searchParams.set("X-Plex-Token", this.token);
    return url.toString();
  }

  async get(path: string): Promise<any> {
    const res = await fetch(this.withToken(path), { headers: { Accept: "application/xml" } });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Plex request failed ${res.status}`);
    return this.parser.parse(text);
  }

  async assertReachable(): Promise<void> {
    await this.get("/identity");
  }
}
