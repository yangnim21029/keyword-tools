export interface Step {
  id: string;
  name: string;
  status: "pending" | "loading" | "completed" | "error";
  durationMs?: number;
}
