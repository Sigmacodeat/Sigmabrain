"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, User } from "lucide-react";
import { addComment, listComments, type Comment } from "@/lib/comments";

interface CommentThreadProps {
  parentSlug: string;
  parentType: string;
  currentUserId: string;
  currentUserName: string;
}

export default function CommentThread({ parentSlug, parentType, currentUserId, currentUserName }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newText, setNewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await listComments(parentSlug);
      setComments(list);
      setLoading(false);
    }
    load();
  }, [parentSlug]);

  async function submit() {
    if (!newText.trim()) return;
    setSending(true);
    try {
      const comment = await addComment({
        parentSlug,
        parentType,
        authorId: currentUserId,
        authorName: currentUserName,
        content: newText.trim(),
      });
      setComments((prev) => [...prev, comment]);
      setNewText("");
    } catch {}
    setSending(false);
  }

  return (
    <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={14} className="text-violet-400" />
        <h4 className="text-xs font-semibold text-[#e8e8f0] uppercase tracking-wider">Kommentare</h4>
        <span className="text-[10px] text-[#8a8aa8]">({comments.length})</span>
      </div>

      {loading ? (
        <div className="text-xs text-[#8a8aa8] py-2">Lade…</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-[#8a8aa8] py-2">Noch keine Kommentare.</div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 p-2 rounded-lg bg-[#0a0a18] border border-[#1e1e3a]">
              <div className="w-6 h-6 rounded-full bg-violet-600/15 flex items-center justify-center shrink-0">
                <User size={12} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#e8e8f0]">{c.authorName}</span>
                  <span className="text-[10px] text-[#8a8aa8]">
                    {new Date(c.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-[#8888aa] mt-0.5 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Kommentar hinzufügen…"
          className="flex-1 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-xs text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50"
        />
        <button
          onClick={submit}
          disabled={sending || !newText.trim()}
          className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
