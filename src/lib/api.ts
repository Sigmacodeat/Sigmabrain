import type {
  BrainPage,
  BrainStats,
  GraphLink,
  GraphNode,
  QueryResponse,
  RecentQuery,
  SearchResult,
} from "./types";

// Browser: same-origin Next.js proxy (/api/*). Server: direct engine URL.
const BASE_URL =
  typeof window !== "undefined"
    ? ""
    : process.env.SIGMABRAIN_API_URL ||
      process.env.GBRAIN_API_URL ||
      process.env.NEXT_PUBLIC_SIGMABRAIN_API_URL ||
      process.env.NEXT_PUBLIC_GBRAIN_API_URL ||
      "http://localhost:3001";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  brain: {
    stats(): Promise<BrainStats> {
      return request("/api/stats");
    },

    search(query: string, limit = 10): Promise<SearchResult[]> {
      return request(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    },

    getPage(slug: string): Promise<BrainPage> {
      const path = slug.split("/").map(encodeURIComponent).join("/");
      return request(`/api/pages/${path}`);
    },

    listPages(options?: { limit?: number; offset?: number; source?: string }): Promise<BrainPage[]> {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.offset) params.set("offset", String(options.offset));
      if (options?.source) params.set("source", options.source);
      return request(`/api/pages?${params.toString()}`);
    },

    graph(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
      return request("/api/graph");
    },

    recentQueries(limit = 10): Promise<RecentQuery[]> {
      return request(`/api/queries/recent?limit=${limit}`);
    },
  },

  query: {
    async think(
      query: string,
      mode: "conservative" | "balanced" | "tokenmax" = "balanced",
      onChunk?: (chunk: string) => void
    ): Promise<QueryResponse> {
      const res = await fetch(`${BASE_URL}/api/think`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (onChunk && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.chunk) onChunk(parsed.chunk);
              } catch {}
            }
          }
        }
      }

      return res.json() as Promise<QueryResponse>;
    },
  },

  upload: {
    async file(
      file: File,
      options?: { title?: string; source?: string; tags?: string[] },
      onProgress?: (progress: number) => void
    ): Promise<{ slug: string; title: string }> {
      const formData = new FormData();
      formData.append("file", file);
      if (options?.title) formData.append("title", options.title);
      if (options?.source) formData.append("source", options.source);
      if (options?.tags) formData.append("tags", JSON.stringify(options.tags));

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${BASE_URL}/api/upload`);

        if (onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.statusText));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(formData);
      });
    },
  },
};

export type { QueryResponse, BrainStats, SearchResult, BrainPage, GraphNode, GraphLink };
