export interface BrainPage {
  slug: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  source?: string;
  tags?: string[];
  entities?: Entity[];
  backlinks?: string[];
  word_count?: number;
}

export interface Entity {
  slug: string;
  type: "person" | "company" | "idea" | "document" | "event" | "place";
  name: string;
  description?: string;
  connections?: EntityConnection[];
}

export interface EntityConnection {
  target_slug: string;
  target_name: string;
  edge_type: string;
  weight?: number;
}

export interface SearchResult {
  slug: string;
  title: string;
  snippet: string;
  score: number;
  evidence?: string;
  source?: string;
  created_at?: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  gaps: string[];
  tokens_used?: number;
  latency_ms?: number;
  mode?: "conservative" | "balanced" | "tokenmax";
}

export interface Citation {
  slug: string;
  title: string;
  quote: string;
  confidence: number;
}

export interface BrainStats {
  total_pages: number;
  total_entities: number;
  total_queries: number;
  total_edges: number;
  last_synced?: string;
  storage_used_mb?: number;
  dream_cycle_last?: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: Entity["type"];
  connections: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  weight?: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "done" | "error";
  progress: number;
  slug?: string;
  error?: string;
}

export interface RecentQuery {
  id: string;
  query: string;
  answer_preview: string;
  citations_count: number;
  created_at: string;
}

export interface PricingTier {
  id: "free" | "pro" | "team";
  name: string;
  price_monthly: number;
  price_yearly: number;
  pages_limit: number;
  queries_limit: number | null;
  features: string[];
  highlight?: boolean;
}
