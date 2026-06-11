"use client";

// Team workspace management — create the org, invite members, share one brain.
// German like the rest of the dashboard. States: loading → no org (create)
// → org view (members, invite [owner], remove [owner], leave).

import { useEffect, useState, useCallback } from "react";
import { Users, Mail, Trash2, LogOut, Crown, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface Member {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

interface OrgState {
  org: { id: string; name: string; ownerId: string } | null;
  members?: Member[];
  isOwner?: boolean;
}

const ERRORS: Record<string, string> = {
  already_in_org: "Du bist bereits in einem Team.",
  invalid_name: "Bitte gib einen Team-Namen mit 2–80 Zeichen ein.",
  owner_only: "Nur der Team-Inhaber kann das.",
  self_invite: "Du bist schon drin — dich selbst einzuladen geht nicht.",
  no_seats_left: "Keine freien Plätze mehr. Upgrade auf einen größeren Plan oder entferne ein Mitglied.",
  already_member: "Diese Person ist bereits Mitglied.",
  invalid_email: "Bitte gib eine gültige E-Mail-Adresse ein.",
  owner_must_remove_members_first: "Als Inhaber zuerst alle Mitglieder entfernen — dann löst sich das Team auf.",
  owner_cannot_remove_self: "Der Inhaber kann sich nicht selbst entfernen.",
  rate_limited: "Zu viele Versuche — bitte kurz warten.",
  generic: "Etwas ist schiefgelaufen. Bitte versuch es erneut.",
};

function errMsg(code?: string): string {
  return ERRORS[code ?? ""] ?? ERRORS.generic;
}

export default function TeamPage() {
  const [state, setState] = useState<OrgState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devJoinUrl, setDevJoinUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/org");
      setState(res.ok ? await res.json() : { org: null });
    } catch {
      setState({ org: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(reload, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  async function act(input: RequestInfo, init: RequestInit, okNotice?: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(input, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errMsg(data.error));
        return null;
      }
      if (okNotice) setNotice(okNotice);
      await reload();
      return data;
    } catch {
      setError(ERRORS.generic);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-[#8888aa] text-sm">
        <Loader2 size={14} className="animate-spin" aria-hidden /> Lade Team…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#e8e8f0]">Team</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">
          Ein gemeinsames Brain für euer ganzes Team — Mitglieder sehen und füttern dasselbe Wissen.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-2.5 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <CheckCircle size={15} className="text-emerald-400 shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-[#a8a8be]">{notice}</p>
        </div>
      )}
      {devJoinUrl && (
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <p className="text-xs text-amber-300 mb-1.5">
            Mail-Provider nicht konfiguriert — gib der Person diesen Einladungs-Link direkt:
          </p>
          <code className="text-xs text-violet-400 break-all">{devJoinUrl}</code>
        </div>
      )}

      {!state?.org ? (
        <Card>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-violet-400" aria-hidden />
              <h2 className="text-base font-semibold text-[#e8e8f0]">Team erstellen</h2>
            </div>
            <p className="text-sm text-[#8888aa] leading-relaxed">
              Erstelle ein Team-Brain und lade Kolleginnen und Kollegen ein. Die Plätze richten
              sich nach deinem Plan (Free/Pro: 1 · Team: 5 · Enterprise: 25). Dein persönliches
              Brain bleibt unangetastet — das Team bekommt ein eigenes.
            </p>
            <form
              className="flex flex-col sm:flex-row gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  "/api/org",
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: orgName }) },
                  "Team erstellt — lade jetzt Mitglieder ein.",
                );
              }}
            >
              <label className="flex-1">
                <span className="sr-only">Team-Name</span>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="z. B. Kanzlei Beispiel & Partner"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <Button type="submit" variant="glow" disabled={busy}>
                Erstellen
              </Button>
            </form>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="p-6 border-b border-[#1e1e3a] flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-[#e8e8f0]">{state.org.name}</h2>
                <p className="text-xs text-[#8888aa] mt-0.5">
                  {state.members?.length ?? 0} Mitglied{(state.members?.length ?? 0) !== 1 ? "er" : ""} · gemeinsames Brain
                </p>
              </div>
              {state.isOwner && <Badge>Inhaber</Badge>}
            </div>
            <ul className="divide-y divide-[#1e1e3a]">
              {(state.members ?? []).map((m) => (
                <li key={m.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-[#e8e8f0] truncate flex items-center gap-1.5">
                      {m.name}
                      {m.isOwner && <Crown size={12} className="text-amber-400 shrink-0" aria-label="Inhaber" />}
                    </p>
                    <p className="text-xs text-[#8888aa] truncate">{m.email}</p>
                  </div>
                  {state.isOwner && !m.isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`${m.name} entfernen`}
                      onClick={() =>
                        void act(
                          "/api/org/member",
                          { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: m.id }) },
                          "Mitglied entfernt — es arbeitet ab sofort wieder im eigenen Brain.",
                        )
                      }
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {state.isOwner && (
            <Card>
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-violet-400" aria-hidden />
                  <h3 className="text-sm font-semibold text-[#e8e8f0]">Mitglied einladen</h3>
                </div>
                <form
                  className="flex flex-col sm:flex-row gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDevJoinUrl(null);
                    void (async () => {
                      const data = await act(
                        "/api/org/invite",
                        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail }) },
                        "Einladung verschickt — Link ist 7 Tage gültig.",
                      );
                      if (data?.devJoinUrl) setDevJoinUrl(data.devJoinUrl);
                      if (data) setInviteEmail("");
                    })();
                  }}
                >
                  <label className="flex-1">
                    <span className="sr-only">E-Mail-Adresse</span>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="kollegin@kanzlei.de"
                      required
                    />
                  </label>
                  <Button type="submit" disabled={busy}>
                    Einladen
                  </Button>
                </form>
              </div>
            </Card>
          )}

          <Card>
            <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-[#e8e8f0]">Team verlassen</h3>
                <p className="text-xs text-[#8888aa] mt-0.5">
                  {state.isOwner
                    ? "Als Inhaber: erst alle Mitglieder entfernen, dann löst Verlassen das Team auf."
                    : "Du arbeitest danach wieder in deinem persönlichen Brain."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void act("/api/org", { method: "DELETE" }, "Du hast das Team verlassen.")}
              >
                <LogOut size={14} aria-hidden /> Verlassen
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
