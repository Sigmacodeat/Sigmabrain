"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Phone, Plus, Search, UserCircle, Users, Pencil, Trash2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { OFFLINE_KEYS, isOnline, enqueueMutation, getCache, setCache } from "@/lib/offline-store";
import type { BrainPage } from "@/lib/types";
import type { ContactFrontmatter } from "@/lib/legal-types";

type ContactRole = NonNullable<ContactFrontmatter["role"]>;

interface ContactItem {
  slug: string;
  title: string;
  role: ContactRole;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface ContactsCache {
  contacts: ContactItem[];
  cases: BrainPage[];
}

const ROLE_LABEL: Record<ContactRole, string> = {
  client: "Mandant",
  opponent: "Gegner",
  court: "Gericht",
  lawyer: "Anwalt",
  other: "Sonstige",
};

function parseContact(page: BrainPage): ContactItem {
  const fm = (page.frontmatter ?? {}) as ContactFrontmatter;
  return {
    slug: page.slug,
    title: page.title,
    role: fm.role || "client",
    name: fm.name || page.title,
    company: fm.company,
    email: fm.email,
    phone: fm.phone,
    address: fm.address,
    notes: fm.notes || page.content || "",
  };
}

function findLinkedCases(contactSlug: string, cases: BrainPage[]): { slug: string; title: string; caseNumber: string }[] {
  return cases
    .filter((p) => {
      const fm = p.frontmatter as Record<string, unknown>;
      if (fm.client_slug === contactSlug) return true;
      if (fm.court_slug === contactSlug) return true;
      const opp = fm.opponent_slugs;
      if (Array.isArray(opp) && opp.includes(contactSlug)) return true;
      return false;
    })
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      caseNumber: String((p.frontmatter as Record<string, unknown>).case_number ?? p.slug),
    }));
}

function slugifyContact(name: string): string {
  return `contact/${name.toLowerCase().trim().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ContactRole>("client");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [cases, setCases] = useState<BrainPage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<ContactRole>("client");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contactPages, casePages] = await Promise.all([
          api.brain.listPages({ type: "legal_contact" }),
          api.brain.listPages({ type: "legal_case" }).catch(() => [] as BrainPage[]),
        ]);
        if (!cancelled) {
          const nextContacts = contactPages.map(parseContact);
          setContacts(nextContacts);
          setCases(casePages);
          await setCache<ContactsCache>(OFFLINE_KEYS.contacts, { contacts: nextContacts, cases: casePages });
        }
      } catch (err) {
        const cached = await getCache<ContactsCache>(OFFLINE_KEYS.contacts);
        if (!cancelled && cached) {
          setContacts(cached.contacts);
          setCases(cached.cases);
          setLoadError("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Kontakte angezeigt.");
        } else {
          if (!cancelled) setLoadError(err instanceof Error ? err.message : "Kontakte konnten nicht geladen werden.");
          if (!cancelled) setContacts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return contacts.filter((contact) =>
      [contact.name, contact.company, contact.email, contact.phone, contact.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle)),
    );
  }, [contacts, query]);

  async function createContact() {
    if (!name.trim()) return;
    const contact: ContactItem = {
      slug: slugifyContact(name),
      title: name.trim(),
      role,
      name: name.trim(),
      company: company.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    const pagePayload = {
      slug: contact.slug,
      title: contact.title,
      type: "legal_contact" as const,
      content: contact.notes || "",
      frontmatter: {
        type: "legal_contact" as const,
        role: contact.role,
        name: contact.name,
        company: contact.company,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        notes: contact.notes,
      },
    };
    if (isOnline()) {
      await api.brain.createPage(pagePayload);
    } else {
      await enqueueMutation({ type: "createPage", payload: pagePayload });
    }
    const nextContacts = [contact, ...contacts];
    setContacts(nextContacts);
    await setCache<ContactsCache>(OFFLINE_KEYS.contacts, { contacts: nextContacts, cases });
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setAddress("");
    setNotes("");
  }

  function startEdit(contact: ContactItem) {
    setEditingSlug(contact.slug);
    setEditName(contact.name);
    setEditRole(contact.role);
    setEditCompany(contact.company ?? "");
    setEditEmail(contact.email ?? "");
    setEditPhone(contact.phone ?? "");
    setEditAddress(contact.address ?? "");
    setEditNotes(contact.notes ?? "");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingSlug || !editName.trim()) return;
    try {
      const updatePayload = {
        slug: editingSlug,
        title: editName.trim(),
        content: editNotes.trim() || "",
        frontmatter: {
          type: "legal_contact" as const,
          role: editRole,
          name: editName.trim(),
          company: editCompany.trim() || undefined,
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          address: editAddress.trim() || undefined,
          notes: editNotes.trim() || undefined,
        },
      };
      if (isOnline()) {
        await api.brain.updatePage(updatePayload);
      } else {
        await enqueueMutation({ type: "updatePage", payload: updatePayload });
      }
      const nextContacts = contacts.map((c) =>
        c.slug === editingSlug
          ? { ...c, name: editName.trim(), title: editName.trim(), role: editRole, company: editCompany.trim() || undefined, email: editEmail.trim() || undefined, phone: editPhone.trim() || undefined, address: editAddress.trim() || undefined, notes: editNotes.trim() || undefined }
          : c
      );
      setContacts(nextContacts);
      await setCache<ContactsCache>(OFFLINE_KEYS.contacts, { contacts: nextContacts, cases });
      setEditingSlug(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function deleteContact(slug: string) {
    if (!confirm("Kontakt wirklich löschen?")) return;
    try {
      if (isOnline()) {
        await api.brain.deletePage(slug);
      } else {
        await enqueueMutation({ type: "deletePage", payload: { slug } });
      }
      const nextContacts = contacts.filter((c) => c.slug !== slug);
      setContacts(nextContacts);
      await setCache<ContactsCache>(OFFLINE_KEYS.contacts, { contacts: nextContacts, cases });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
            <Users size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8e8f0]">Kontakte</h1>
            <p className="text-sm text-[#8888aa]">Mandanten, Gegner, Gerichte und Ansprechpartner</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#e8e8f0]">Kontakt anlegen</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_150px] gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
          <select value={role} onChange={(e) => setRole(e.target.value as ContactRole)} className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50">
            {Object.entries(ROLE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Firma / Organisation" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
        </div>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Adresse" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
        <div className="flex gap-3">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notizen" className="flex-1 bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
          <Button onClick={createContact} disabled={!name.trim()} className="self-start bg-violet-600 hover:bg-violet-500 text-white gap-2">
            <Plus size={14} />
            Anlegen
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8aa8]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kontakte suchen…" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[#8888aa]">Lade Kontakte…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <UserCircle size={44} className="mx-auto text-[#1e1e3a]" />
          <p className="text-sm text-[#8888aa]">Noch keine passenden Kontakte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((contact) => {
            const linked = findLinkedCases(contact.slug, cases);
            const isEditing = editingSlug === contact.slug;
            if (isEditing) {
              return (
                <div key={contact.slug} className="rounded-xl border border-violet-500/20 bg-[#0d0d1a] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#e8e8f0]">Kontakt bearbeiten</h3>
                    <button onClick={() => setEditingSlug(null)} className="text-[#8a8aa8] hover:text-[#e8e8f0]"><X size={14} /></button>
                  </div>
                  <div className="space-y-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value as ContactRole)} className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-violet-500/50">
                      {Object.entries(ROLE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="Firma" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                      <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="E-Mail" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Telefon" className="bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                    </div>
                    <textarea value={editAddress} onChange={(e) => setEditAddress(e.target.value)} rows={2} placeholder="Adresse" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                    <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Notizen" className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50" />
                  </div>
                  {editError && <p className="text-xs text-red-400">{editError}</p>}
                  <div className="flex justify-end">
                    <Button onClick={saveEdit} disabled={!editName.trim()} className="bg-violet-600 hover:bg-violet-500 text-white gap-2 text-xs">
                      <Save size={14} /> Speichern
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={contact.slug} className="rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#e8e8f0]">{contact.name}</div>
                    {contact.company && <div className="text-xs text-[#8a8aa8]">{contact.company}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="default" className="text-[10px] border border-violet-500/20 bg-violet-500/10 text-violet-300">{ROLE_LABEL[contact.role]}</Badge>
                    <button onClick={() => startEdit(contact)} className="p-1.5 rounded-lg text-[#8a8aa8] hover:text-violet-400 hover:bg-violet-500/10 transition-all" title="Bearbeiten"><Pencil size={13} /></button>
                    <button onClick={() => deleteContact(contact.slug)} className="p-1.5 rounded-lg text-[#8a8aa8] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Löschen"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-[#8888aa]">
                  {contact.email && <div className="flex items-center gap-2"><Mail size={12} />{contact.email}</div>}
                  {contact.phone && <div className="flex items-center gap-2"><Phone size={12} />{contact.phone}</div>}
                  {contact.address && <div className="whitespace-pre-wrap">{contact.address}</div>}
                </div>
                {linked.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-[#8a8aa8] font-semibold">Verknüpfte Akten</div>
                    {linked.map((c) => (
                      <Link key={c.slug} href={`/dashboard/cases/${encodeURIComponent(c.slug)}`} className="block text-xs text-violet-400 hover:underline truncate">
                        {c.caseNumber} — {c.title}
                      </Link>
                    ))}
                  </div>
                )}
                {contact.notes && <p className="text-xs text-[#8a8aa8] line-clamp-3">{contact.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
