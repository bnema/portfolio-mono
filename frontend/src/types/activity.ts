// src/types/activity.ts
export interface Activity {
  id: string;
  type: "commit" | "tweet" | "other";
  timestamp: string;
  content: string;
  url?: string;
  isPrivate?: boolean;
  metadata?: {
    [key: string]: any;
  };
}
