"use client";

import { useState, useCallback, useEffect } from "react";
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
  Archive,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { isOnline } from "@/lib/offline-store";
import { sha256HexBytes, gobdFrontmatter } from "@/lib/gobd";

interface UploadFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  slug?: string;
  gobdStamped?: boolean;
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
    txt: "text-[#585866]",
    pdf: "text-red-400",
    json: "text-amber-400",
  };
  return <File size={20} className={colors[ext || ""] || "text-[#585866]"} />;
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
  // GoBD-Baustein: steuerlich relevante Belege beim Ingest mit Aufbewahrungs-
  // frist + Inhalts-Hash stempeln (§ 147 AO / § 146 Abs. 4 AO). Bewusst opt-in:
  // nicht jeder Upload ist ein Buchungsbeleg.
  const [gobdReceipt, setGobdReceipt] = useState(false);

  // File System Access API (Chromium) — feature-detected client-side so we can
  // show an IDE-style "ganzen Ordner einlesen"-Button only where it actually works.
  const [folderApi, setFolderApi] = useState(false);
  const [scanning, setScanning] = useState(false);
  useEffect(() => {
    setFolderApi(typeof window !== "undefined" && "showDirectoryPicker" in window);
  }, []);

  const addFiles = useCallback((accepted: File[]) => {
    if (accepted.length === 0) return;
    if (!isOnline()) {
      const offlineFiles: UploadFile[] = accepted.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: "error" as const,
        progress: 0,
        error: "Offline — Datei-Upload erfordert Internetverbindung. Datei wurde nicht gespeichert.",
      }));
      setFiles((prev) => [...prev, ...offlineFiles]);
      return;
    }
    const newFiles: UploadFile[] = accepted.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024,
  });

  // Walk a chosen local folder (recursively, like an IDE "open folder") and pull
  // every supported file into the same upload queue. No server round-trip until
  // the user clicks "Upload" — the files stay client-side until then.
  const ACCEPT_RE = /\.(md|txt|pdf|json)$/i;
  const MAX_BYTES = 50 * 1024 * 1024;
  const pickFolder = useCallback(async () => {
    interface FsHandle {
      kind: "file" | "directory";
      getFile?: () => Promise<File>;
      values?: () => AsyncIterable<FsHandle>;
    }
    const picker = (window as unknown as {
      showDirectoryPicker?: () => Promise<FsHandle>;
    }).showDirectoryPicker;
    if (!picker) return;
    try {
      setScanning(true);
      const dir = await picker();
      const out: File[] = [];
      const walk = async (handle: FsHandle, depth: number) => {
        if (depth > 5 || !handle.values) return;
        for await (const entry of handle.values()) {
          if (entry.kind === "file" && entry.getFile) {
            const f = await entry.getFile();
            if (ACCEPT_RE.test(f.name) && f.size <= MAX_BYTES) out.push(f);
          } else if (entry.kind === "directory") {
            await walk(entry, depth + 1);
          }
        }
      };
      await walk(dir, 0);
      addFiles(out);
    } catch {
      // user dismissed the picker, or the browser blocked it — no-op
    } finally {
      setScanning(false);
    }
  }, [addFiles]);

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

        // GoBD-Stempel: Hash über die hochgeladenen Datei-Bytes + 10-Jahre-
        // Aufbewahrungsfrist ins Frontmatter mergen. Eine spätere Verifikation
        // (Originaldatei erneut hashen) deckt jede Byte-Änderung auf.
        let gobdStamped = false;
        if (gobdReceipt && result.slug) {
          try {
            const bytes = await uploadFile.file.arrayBuffer();
            const hash = await sha256HexBytes(bytes);
            await api.brain.updatePage({
              slug: result.slug,
              frontmatter: { belegart: "steuerbeleg", ...gobdFrontmatter(hash) },
            });
            gobdStamped = true;
          } catch (stampErr) {
            // Upload ist erfolgt; nur der Stempel fehlt — sichtbar machen, nicht
            // den ganzen Upload als Fehler werten.
            console.error("[upload] GoBD-Stempel fehlgeschlagen:", stampErr instanceof Error ? stampErr.message : String(stampErr));
          }
        }

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: "done", progress: 100, slug: result.slug, gobdStamped }
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
        <h1 className="text-2xl font-bold text-[#15151d]">Dokument hochladen</h1>
        <p className="text-sm text-[#585866] mt-0.5">
          Markdown, PDF oder Text — Sigmabrain chunked, embeddet und indiziert automatisch.
        </p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-[#585866] uppercase tracking-wider font-medium mb-2">
            Brain Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2.5 text-sm text-[#15151d] focus:outline-none focus:border-violet-500/50 transition-colors"
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
          <label className="block text-xs text-[#585866] uppercase tracking-wider font-medium mb-2">
            Tags (kommasepariert)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="z.B. fintech, q2-2026, alice"
            className="w-full bg-[#ffffff] border border-[#e2e4ec] rounded-lg px-3 py-2.5 text-sm text-[#15151d] placeholder:text-[#585866] focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      </div>

      {/* GoBD-Belegstempel (opt-in) */}
      <label className="flex items-start gap-3 p-4 rounded-xl border border-[#e2e4ec] bg-[#ffffff] cursor-pointer hover:border-[#b4b9c8] transition-colors">
        <input
          type="checkbox"
          checked={gobdReceipt}
          onChange={(e) => setGobdReceipt(e.target.checked)}
          className="mt-0.5 accent-violet-600"
        />
        <span className="flex items-start gap-2.5 text-sm">
          <Archive size={15} className="text-violet-400 shrink-0 mt-0.5" />
          <span className="text-[#585866] leading-relaxed">
            <strong className="text-[#15151d]">Steuerlich relevanter Beleg (GoBD-Bausteine)</strong> — Rechnungen,
            Kontoauszüge, Quittungen. Beim Hochladen werden eine 10-Jahre-Aufbewahrungsfrist
            (§ 147 AO) und ein Inhalts-Hash zur Manipulations-Evidenz (§ 146 Abs. 4 AO) ins
            Frontmatter geschrieben. Spätere Verifikation deckt Änderungen auf.
            <span className="block text-[11px] text-[#585866] mt-1">
              Technischer Baustein — volle GoBD-Konformität verlangt zusätzlich Verfahrensdokumentation
              und Prüfer-Abnahme.
            </span>
          </span>
        </span>
      </label>

      {/* Offline warning */}
      {!isOnline() && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm">
          <CloudUpload size={16} />
          <span>Offline-Modus aktiv — Datei-Upload erfordert Internetverbindung.</span>
        </div>
      )}

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-violet-500/60 bg-violet-500/[0.06] ring-1 ring-violet-500/20"
            : "border-[#d6d9e3] hover:border-violet-500/30 hover:bg-violet-500/[0.02]",
          !isOnline() && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
            isDragActive ? "bg-violet-500/20" : "bg-[#e2e4ec]"
          )}>
            <CloudUpload size={28} className={isDragActive ? "text-violet-400" : "text-[#585866]"} />
          </div>
          <div>
            <p className="text-base font-semibold text-[#15151d] mb-1">
              {isDragActive ? "Loslassen zum Hochladen" : "Dateien hierher ziehen"}
            </p>
            <p className="text-sm text-[#585866]">
              oder <span className="text-violet-400 hover:underline">Dateien auswählen</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {[".md", ".txt", ".pdf", ".json"].map((ext) => (
              <Badge key={ext} variant="default" className="font-mono text-xs">{ext}</Badge>
            ))}
            <span className="text-xs text-[#585866]">· max 50 MB</span>
          </div>
        </div>
      </div>

      {/* IDE-style folder import (Chromium only) */}
      {folderApi && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 -mt-1">
          <Button
            variant="secondary"
            onClick={pickFolder}
            disabled={scanning || !isOnline()}
            className="gap-2"
          >
            <FolderOpen size={15} />
            {scanning ? "Ordner wird gelesen…" : "Ganzen Ordner einlesen"}
          </Button>
          <p className="text-xs text-[#585866]">
            Wählt einen lokalen Ordner wie eine IDE und liest alle unterstützten Dateien
            (auch in Unterordnern) ins Brain ein — nichts wird hochgeladen, bis du auf „Upload“ klickst.
          </p>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-[#585866] leading-relaxed">
          <strong className="text-[#15151d]">Wie funktioniert es?</strong> Sigmabrain chunked das Dokument automatisch,
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
            <h3 className="text-sm font-semibold text-[#15151d]">
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
                className="flex items-center gap-3 p-4 rounded-xl border border-[#e2e4ec] bg-[#ffffff]"
              >
                <FileIcon name={f.file.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#15151d] truncate">{f.file.name}</span>
                    <span className="text-xs text-[#585866] shrink-0">{formatBytes(f.file.size)}</span>
                  </div>
                  {f.status === "uploading" && (
                    <div className="h-1 bg-[#e2e4ec] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-600 rounded-full transition-all duration-200"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}
                  {f.status === "done" && f.slug && (
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-emerald-400">→ {f.slug}</span>
                      {f.gobdStamped && (
                        <Badge variant="default" className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 gap-1">
                          <Archive size={10} /> GoBD gestempelt
                        </Badge>
                      )}
                    </span>
                  )}
                  {f.status === "error" && (
                    <span className="text-xs text-red-400">{f.error}</span>
                  )}
                  {f.status === "pending" && (
                    <span className="text-xs text-[#585866]">Bereit zum Hochladen</span>
                  )}
                </div>
                <div className="shrink-0">
                  {f.status === "pending" && (
                    <button onClick={() => removeFile(f.id)} className="text-[#585866] hover:text-red-400 transition-colors">
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
          <p className="text-sm text-[#585866] mb-4">
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
