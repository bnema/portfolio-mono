// commit-service.ts
import { Commit } from "./types";

export class CommitService {
  constructor(private apiUrl: string) {}

  async fetchCommits(
    page: number,
    limit: number,
    signal: AbortSignal,
  ): Promise<{ commits: Commit[]; total_count: number }> {
    try {
      const response = await fetch(
        `${this.apiUrl}/commits?page=${page}&limit=${limit}`,
        { signal },
      );

      if (response.status === 200) {
        return response.json();
      } else {
        throw response.text();
      }
    } catch (error) {
      throw new Error("Failed to fetch commits");
    }
  }
}
