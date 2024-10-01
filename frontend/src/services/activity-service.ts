// src/services/activity-service.ts
import { Activity } from "../types/activity";

export interface ActivityService {
  fetchActivities(limit: number, page: number): Promise<Activity[]>;
}
