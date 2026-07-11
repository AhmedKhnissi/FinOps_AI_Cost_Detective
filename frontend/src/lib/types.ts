// Shared types mirroring the FastAPI backend responses.

export type Severity = "high" | "medium" | "low";

export interface Issue {
  title: string;
  severity: Severity;
  resource?: string | null;
  description: string;
  estimated_savings?: string | null;
}

export interface Analysis {
  summary: string;
  issues: Issue[];
  estimated_savings?: string | null;
  fix_commands: string[];
}

export interface ResourceGroup {
  name: string;
  location?: string;
  id?: string;
  provisioning_state?: string | null;
  tags?: Record<string, string>;
}

export interface HistoryEntry {
  id: string;
  resource_group: string;
  resources_scanned: number;
  issues_found: number;
  estimated_savings: string | null;
  analysis_result: Analysis | null;
  status: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  email: string;
}
