// commit-service.ts
import { Commit } from "./types";

export class CommitService {
  constructor(private apiUrl: string) {}

  async fetchCommits(
    page: number,
    limit: number,
  ): Promise<{ commits: Commit[]; total_count: number }> {
    const response = await fetch(
      `${this.apiUrl}/commits?page=${page}&limit=${limit}`,
    );
    if (!response.ok) throw new Error("Failed to fetch commits");
    return await response.json();
  }
}
