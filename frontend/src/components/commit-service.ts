// commit-service.ts
import { Commit } from "./types";

export class CommitService {
  constructor(private apiUrl: string) {}

  async fetchCommits(
    page: number,
    limit: number,
  ): Promise<{ commits: Commit[]; total_count: number }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/commits?page=${page}&limit=${limit}`,
      );

      if (response.status === 404) {
        throw new Error("Commits not found. The requested page may not exist.");
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorBody}`,
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Unexpected content type: ${contentType}`);
      }

      const data = await response.json();

      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format");
      }

      if (
        !Array.isArray(data.commits) ||
        typeof data.total_count !== "number"
      ) {
        throw new Error("Response does not match expected structure");
      }

      return data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON parsing error: ${error.message}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to fetch commits: ${error.message}`);
      }
      throw new Error("An unknown error occurred while fetching commits");
    }
  }
}
