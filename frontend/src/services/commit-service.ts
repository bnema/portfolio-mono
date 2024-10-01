// src/services/commit-service.ts
import { ActivityService } from "./activity-service";
import { Activity } from "../types/activity";
import { Commit } from "../types/commit";

export class CommitService implements ActivityService {
  constructor(private apiUrl: string) {}

  async fetchActivities(limit: number, page: number): Promise<Activity[]> {
    try {
      const response = await fetch(
        `${this.apiUrl}/commits?limit=${limit}&page=${page}`,
      );
      console.log("Response:", response);
      if (!response.ok) {
        throw new Error(`Failed to fetch commits: ${response.statusText}`);
      }
      const data: { commits: Commit[] } = await response.json();
      return data.commits.map(this.convertCommitToActivity);
    } catch (error) {
      console.error("Error fetching commits:", error);
      throw error; // Rethrow the error so it can be caught in the ActivityList component
    }
  }

  private convertCommitToActivity(commit: Commit): Activity {
    return {
      id: commit.id,
      type: "commit",
      timestamp: commit.timestamp,
      content: commit.message,
      url: commit.url,
      isPrivate: commit.is_private,
      metadata: {
        repoName: commit.repo_name,
      },
    };
  }
}
