export interface PlanActualResult {
  regency: string;
  year: number;
  month: number;
  sales_executive: string | null;
  project_id: number;
  project_name: string;
  plan_attendance: number;
  actual_attendance: number;
  attendance_achievement: number;
  plan_activity: number;
  actual_activity: number;
  activity_achievement: number;
}
