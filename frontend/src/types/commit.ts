// src/types/commit.ts

export interface Commit {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  repo_name: string;
  is_private: boolean;
}
