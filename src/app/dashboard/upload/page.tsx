"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  File,
  CheckCircle,
  XCircle,
  Loader,
  X,
  CloudUpload,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  slug?: string;
}

const ACCEPTED_TYPES = {
  "text/markdown": [".md"],
  "text/plain": [".txt"],
  "application/pdf": [".pdf"],
  "application/json": [".json"],
};

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const colors: Record<string, string> = {
    md: "text-blue-400",
    txt: "text-[#8888aa]",
    pdf: "text-red-400",
    json: "text-amber-400",
  };
  return <File size={20} className={colors[ext || ""] || "text-[#4a4a6a]"} />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [source, setSource] = useState("wiki");
  const [tags, setTags] = useState("");

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles: UploadFile[] = accepted.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const uploadFile of pending) {
      setFiles((prev) =>
        prev.map((f) => f.id === uploadFile.id ? { ...f, status: "uploading", progress: 0 } : f)
      );

      try {
        const title = uploadFile.file.name.replace(/\.[^.]+$/, "");
        const result = await api.upload.file(
          uploadFile.file,
          { title, source, tags: tagList.length > 0 ? tagList : undefined },
          (progress) => {
            setFiles((prev) =>
              prev.map((f) => f.id === uploadFile.id ? { ...f, progress } : f)
            );
          }
        );
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "done", progress: 100, slug: result.slug }
              : f
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "error", error: msg }
              : f
          )
        );
      }
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e8e8f0]">Dokument hochladen</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">
          Markdown, PDF oder Text — Sigmabrain chunked, embeddet und indiziert automatisch.
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[#4a4a6a] uppercase tracking-wider font-medium mb-2">
            Brain Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full bg-[#0d0d1a] border border-[#1e1e3a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50 transition-colors"
          >
            <option value="wiki">wiki</option>
            <option value="meetings">meetings</option>
            <option value="people">people</option>
            <option value="companies">companies</option>
            <option value="ideas">ideas</option>
            <option value="documents">documents</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#4a4a6a] uppercase tracking-wider font-medium mb-2">
            Tags (kommasepariert)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="z.B. fintech, q2-2026, alice"
            className="w-full bg-[#0d0d1a] border border-[#1e1e3a] rounded-lg px-3 py-2.5 text-sm text-[#e8e8f0] placeholder:text-[#4a4a6a] focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-violet-500 bg-violet-500/10"
            : "border-[#1e1e3a] hover:border-[#3a3a6a] hover:bg-[#0d0d1a]"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
            isDragActive ? "bg-violet-500/20" : "bg-[#1e1e3a]"
          )}>
            <CloudUpload size={28} className={isDragActive ? "text-violet-400" : "text-[#4a4a6a]"} />
          </div>
          <div>
            <p className="text-base font-semibold text-[#e8e8f0] mb-1">
              {isDragActive ? "Loslassen zum Hochladen" : "Dateien hierher ziehen"}
            </p>
            <p className="text-sm text-[#4a4a6a]">
              oder <span className="text-violet-400 hover:underline">Dateien auswählen</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {[".md", ".txt", ".pdf", ".json"].map((ext) => (
              <Badge key={ext} variant="default" className="font-mono text-xs">{ext}</Badge>
            ))}
            <span className="text-xs text-[#4a4a6a]">· max 50 MB</span>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-[#8888aa] leading-relaxed">
          <strong className="text-[#e8e8f0]">Wie funktioniert es?</strong> Sigmabrain chunked das Dokument automatisch,
          erstellt Embeddings und indiziert es im Wissensgraph. Entitäten (Personen, Firmen, Konzepte)
          werden extrahiert und verknüpft. Danach kannst du das Dokument über die Query-Seite abfragen.
          <br />
          <strong className="text-blue-400 mt-1 block">Hinweis:</strong> Die Sigmabrain Engine muss laufen ({`gbrain serve`}).
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#e8e8f0]">
              {files.length} Datei{files.length !== 1 ? "en" : ""}
              {doneCount > 0 && <span className="text-emerald-400 ml-2">· {doneCount} fertig</span>}
            </h3>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <Button size="sm" variant="glow" onClick={uploadAll}>
                  <Upload size={13} />
                  {pendingCount} hochladen
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setFiles([])}>
                Alle löschen
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a]"
              >
                <FileIcon name={f.file.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#e8e8f0] truncate">{f.file.name}</span>
                    <span className="text-xs text-[#4a4a6a] shrink-0">{formatBytes(f.file.size)}</span>
                  </div>
                  {f.status === "uploading" && (
                    <div className="h-1 bg-[#1e1e3a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-600 rounded-full transition-all duration-200"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                  {f.status === "done" && f.slug && (
                    <span className="text-xs font-mono text-emerald-400">→ {f.slug}</span>
                  )}
                  {f.status === "error" && (
                    <span className="text-xs text-red-400">{f.error}</span>
                  )}
                  {f.status === "pending" && (
                    <span className="text-xs text-[#4a4a6a]">Bereit zum Hochladen</span>
                  )}
                </div>
                <div className="shrink-0">
                  {f.status === "pending" && (
                    <button onClick={() => removeFile(f.id)} className="text-[#4a4a6a] hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                  {f.status === "uploading" && (
                    <Loader size={14} className="text-violet-400 animate-spin" />
                  )}
                  {f.status === "done" && (
                    <CheckCircle size={14} className="text-emerald-400" />
                  )}
                  {f.status === "error" && (
                    <XCircle size={14} className="text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps after upload */}
      {doneCount > 0 && (
        <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{doneCount} Datei{doneCount !== 1 ? "en" : ""} hochgeladen</span>
          </div>
          <p className="text-sm text-[#8888aa] mb-4">
            Dein Brain wird indexiert. Sobald Sigmabrain die Embeddings erstellt hat, kannst du die Dokumente abfragen.
          </p>
          <div className="flex gap-3">
            <Button size="sm" variant="success" onClick={() => window.location.href = "/dashboard/query"}>
              Brain jetzt fragen
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.location.href = "/dashboard/brain"}>
              Brain erkunden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
