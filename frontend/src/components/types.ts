// ./types.ts

export interface Commit {
  id: string;
  repo_name: string;
  message: string;
  timestamp: string;
  url: string;
  is_private: boolean;
  isNew: boolean;
}
