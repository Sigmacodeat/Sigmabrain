# Sigmabrain — Repo-Scan & Gap-Analyse vs. Gesamtmarkt

> **INTERN — nicht in öffentliche Releases aufnehmen.** Stand: 11. Juni 2026.
> Basis: vollständiger Repo-Scan (inkl. laufender Parallel-Arbeit der KI-Agenten),
> Markt-Research Runden 1–3 (`SIGMABRAIN_STRATEGIE.md` §4–4b, `/compare`-Quellen).
> Ergänzt: `SIGMABRAIN_STATUS.md` (Was ist echt), `SIGMABRAIN_STRATEGIE.md` (Warum).

---

## 1. Repo-Inventar (was wir HABEN, Stand heute)

**Engine (Kern, produktionsreif, tausende Tests):**
- 91 Operationen contract-first (`src/core/operations.ts`), CLI + MCP generiert
- Hybrid-Retrieval: Vector + BM25 + Graph-Traversal + RRF, typed-edge relational
  retrieval (v0.42.34), Query-Cache mit knobs_hash-Isolation, 3 Search-Modes
- Selbstverdrahtender Wissensgraph (typisierte Kanten bei jedem Write, ohne Extra-LLM)
- Dream Cycle (Dedupe, Zitate, Widersprüche, Morning-Brief), Gap-Analyse in Antworten
- Multi-Tenant: Source-Isolation fuzz-getestet, scoped access, Trust-Boundary remote/local
- Engines: PGLite (zero-config) + Postgres/Supabase, Parität CI-gepinnt
- Resumable Sync, Jobs/Minions, Eval-Suite (BrainBench, longmemeval, Metric-Glossary)

**Ingestion (diese Woche massiv ausgebaut):**
- Dokument-Pipeline NEU: PDF (+ Scanned-OCR-Fallback), DOCX, EML, CSV/TSV, XLSX,
  Audio-Transkription (`src/core/extract-document.ts`, 15 Tests, compile-verifiziert)
- 9 Konnektoren NEU (Parallel-Arbeit): Gmail, Google Drive, Calendar, Notion, Slack,
  Jira, Asana, Dropbox, GitHub (`src/core/ingestion/connectors/` + OAuth + Daemon)
- Bilder mit OCR + EXIF, Code-Repos (tree-sitter), Web-Content, Meeting-Transkripte

**Skills & Vertikalisierung:**
- 58 Skill-Verzeichnisse, Resolver-Routing, Conformance-Tests
- Schema-Packs NEU: `gbrain-legal.yaml`, `gbrain-tax.yaml`, `gbrain-medical.yaml`
  (+ investor, engineer, creator, base)
- NEU: deadline-extract, document-ingest, connector-ingest, legal-brain (Dispatcher)

**Legal-Brain-Subsystem (Parallel-Arbeit, in Entwicklung):**
- `src/core/legal/` (anonymizer HMAC, repository, types), `src/commands/legal.ts`,
  `LEGAL_BRAIN_BLUEPRINT.md` (Profile, Fälle, Gegner-Analyse, Rechtsfrage-Flow),
  Admin-Seite `Legal.tsx` — ⚠️ Risiko-Flags in §4

**Produkt-Oberflächen:**
- Web-App: Marketing (24 Routen EN+DE, 5 Vertikale, /compare), Dashboard (7 Seiten),
  Auth (HMAC-Sessions, scrypt), Billing-Skeleton (Stripe-ready), Referral, PWA
- Admin-Panel (`admin/`): Dashboard, Agents, Jobs, RequestLog, Calibration, Legal NEU
- NEU: `web-api.ts` (HTTP-API für Frontends), `nl-console.ts` (NL-Admin-Queries)
- Mobile: Capacitor-Scaffold + Store-Guide

---

## 2. Gap-Matrix vs. Gesamtmarkt

Legende: ✅ haben · 🟡 teilweise · ❌ fehlt · Priorität P0 (launch-blockierend) → P3 (nach Traktion)

### 2a. vs. Enterprise Legal AI (Harvey, Legora, CoCounsel, Noxtua, Luminance)

| Capability | Status | Prio | Kommentar |
|---|---|---|---|
| Q&A über eigene Akten, zitiert | ✅ | — | Unsere Kernstärke; seitengenau |
| Widerspruchs-Erkennung, Gap-Analyse, Graph | ✅ | — | Kein Wettbewerber zeigt das öffentlich |
| Rechtsrecherche (Rechtsdatenbank) | ❌ | P2 | Bewusst nicht unsere Kategorie. ABER: Anbindung ÖFFENTLICHER Quellen (rechtsprechung-im-internet.de, openlegaldata.io, EUR-Lex API) als „Public-Law-Konnektor" ist machbar und würde Flow 3 des Legal Brain legal füttern |
| Drafting / Redlining | ❌ | P3 | Bewusst nicht (siehe /compare). Nicht bauen |
| Legal-Benchmark-Teilnahme (Vals VLAIR) | ❌ | P2 | Eigene VLAIR-artige Eval auf Dokument-Q&A/Chronologie fahren — die Disziplinen, die wir können. Glaubwürdigkeits-Hebel |
| Matter-/Fall-Management | 🟡 | P1 | legal-brain-Subsystem entsteht parallel; braucht Tests + Berufsrechts-Review (§4) |
| Zitat-Sprung-UI (Antwort → Fundstelle, 1 Klick) | 🟡 | P1 | Engine liefert Zitate; Dashboard-UI fehlt. Vertrauens-Feature Nr. 1 für Anwälte |
| **DMS-Integration (iManage, NetDocuments)** | ❌ | P2 | DER Enterprise-Legal-Einkaufsfilter. Ohne: kein BigLaw — aber Mid-Market (unser Wedge) nutzt Datev/Dropbox/Drive → 🟡 via neue Konnektoren |
| **beA / e-Akte (DE)** | ❌ | P2 | DACH-Kanzlei-Differenzierer, kein US-Anbieter hat es. EML-Ingest ist die Vorstufe |
| **DATEV-Schnittstelle (Steuer-Vertikale)** | ❌ | P1–P2 | „Neben DATEV" verkauft sich nur mit Daten-Brücke (DATEV-Export-Import reicht für V1: CSV/XML kommt durch unsere neue Pipeline) |
| Audit-Trail (Hash-Kette, Compliance) | ❌ | P2 | Enterprise-Tier-Argument; Subsumio-Konzept notiert |
| SSO / SAML / SCIM | ❌ | P1 | Enterprise-Gate; jeder Wettbewerber hat es |
| SOC 2 / ISO 27001 | ❌ | P2 | Luminance/Glean haben es. Self-Host kompensiert im Mid-Market, Enterprise fragt trotzdem |

### 2b. vs. Knowledge Layer (Glean, Notion AI)

| Capability | Status | Prio | Kommentar |
|---|---|---|---|
| Konnektoren | 🟡 | P1 | 9 NEU vs. Gleans 100+. Die 9 decken ~80 % des Mid-Market-Bedarfs. Fehlt im Kern-Set: Outlook/M365 + Teams (DACH-Kanzleien sind Microsoft-Land!), SharePoint |
| **ACL-Vererbung aus Quellen** | ❌ | P1 | Glean übernimmt Berechtigungen der Quellsysteme. Unsere Konnektoren ingestieren in den eigenen Scope — sobald ein geteiltes Brain Drive/Slack synct, wird das zur Leak-Falle. Vor Team-Launch lösen oder Konnektoren auf Single-User-Brains beschränken |
| Browser-Extension / Slack-Bot-Surface | ❌ | P3 | Convenience, nach Traktion |
| Eigene Daten + Graph + Gap-Analyse | ✅ | — | Glean hat Graph, aber keine Gap-Analyse; Notion keins von beidem |
| Self-Host + Open Source | ✅ | — | Unser Strukturvorteil, SaaS-only-Konkurrenz kann nicht folgen |

### 2c. vs. SaaS-Grundanforderungen (alle Anbieter)

| Capability | Status | Prio | Kommentar |
|---|---|---|---|
| **Hosted Multi-Tenant-Provisioning** | ❌ | **P0** | Pre-Mortem K1, unverändert der Killer: Signup → Brain läuft. Scoping-Technik existiert; Provisioning-Pfad fehlt |
| Billing live (Stripe-Keys, Coupons) | 🟡 | P0 | Code fertig, Konto/Keys fehlen (nur Owner kann) |
| Domain, E-Mail, Hosting | ❌ | P0 | Nur Owner kann |
| Mobile Apps im Store | 🟡 | P3 | Scaffold da; erst nach SaaS-Launch (Apple 4.2) |
| Usage-Metering im Dashboard | 🟡 | P1 | Fair-Use versprochen; Anzeige fehlt |

---

## 3. USP-Bewertung: das „Subgehirn über alle Kanzleien"

**Frage:** Ein Gehirn, das aus allem lernt, was in unsere Software reinkommt, sich
„über alle Kanzleien und wichtige Entscheidungen auskennt" — ist das ein USP?

**Ehrliche Antwort: In dieser Formulierung NEIN — es ist das Gegenteil, ein
Deal-Killer.** Drei Gründe:

1. **Es widerspricht wörtlich unserem eigenen Verkaufsargument.** Auf jeder
   Vertikal-Seite steht: „Dein Dealflow/Netzwerk trainiert niemals fremde Modelle"
   und „Mandantendaten verlassen nie eure Kontrolle". Ein Cross-Kanzlei-Lernen aus
   Kundendaten macht jede dieser Seiten zur Falschaussage — und unser /compare-
   Vertrauensversprechen kollabiert.
2. **Berufsrecht macht es unverkäuflich.** § 203 StGB + anwaltliche Verschwiegenheit:
   Eine Kanzlei darf Mandatsinhalte nicht in einen Pool geben, aus dem andere
   Kanzleien (potenziell die GEGENSEITE) Nutzen ziehen. Auch „anonymisiert" rettet
   das nicht: HMAC-Pseudonymisierung (so implementiert in
   `src/core/legal/anonymizer.ts`) ist DSGVO-rechtlich KEINE Anonymisierung —
   mit Owner-Key reversibel = pseudonym = bleibt personenbezogen. Und Fallkonstellationen
   sind re-identifizierbar (kleiner Gerichtsbezirk + Rechtsgebiet + Datum reicht).
3. **Gegner-Profiling benannter Anwälte/Kanzleien** („Schwächen", Erfolgsquoten) aus
   Pool-Daten ist DSGVO-Profiling natürlicher Personen + UWG-Risiko. Aus ÖFFENTLICHEN
   Quellen (Urteilsdatenbanken) ist es vertretbarer — aus Kundendaten nicht.

**ABER: Drei legale Varianten desselben Instinkts sind echte USPs:**

| Variante | Was es ist | USP-Wert |
|---|---|---|
| **A. Compounding-Brain pro Kanzlei** | Jedes Kunden-Brain wird mit JEDEM eigenen Fall besser (eigene Präzedenzfälle, eigene Gegner-Historie, eigene Gerichts-Erfahrung). Harvey/Noxtua sind pro Anfrage stateless — wir verzinsen. | **Hoch — das ist unser Kern-USP und heute schon wahr.** „Das Brain eurer Kanzlei kennt nach 2 Jahren jeden Fall, den ihr je geführt habt" schlägt jedes Pool-Versprechen, weil es verkaufbar UND legal ist |
| **B. Zentrales Public-Law-Brain** | EIN von uns gepflegtes Subgehirn aus ausschließlich ÖFFENTLICHEN Quellen (Urteile, Gesetze, Gerichtsstatistiken), als mountbares Brain an alle Kunden ausgeliefert (`gbrain mounts add` existiert!). Gegner-Analyse speist sich HIERAUS. | Mittel-hoch — legal sauber, technisch sofort machbar (mounts + Konnektoren), differenziert gegen US-Anbieter im DACH-Recht. Aber: Content-Moat von beck-online/Westlaw bleibt unerreichbar; wir kuratieren offene Quellen statt sie zu ersetzen |
| **C. Opt-in-Struktur-Lernen** | Aggregiertes Lernen über NUTZUNG, nie Inhalte: welche Schema-Felder, Query-Muster, Extraktions-Prompts funktionieren. Fließt als Produkt-Updates (Schema-Packs, Tuning) an alle. | Mittel — Standard-SaaS-Praxis, sauber per AVV deklarierbar, macht das Produkt schneller besser, ist aber kein Marketing-Claim für „kennt alle Kanzleien" |

**Empfohlene Sprachregelung nach außen:** „Jede Kanzlei bekommt ihr eigenes Gehirn,
das mit jedem Fall klüger wird — plus ein zentrales Rechtswissen-Brain aus
öffentlichen Quellen, das wir für alle pflegen. Eure Mandate bleiben eure."
Das Wort „Subgehirn über alle Kanzleien" intern streichen; es beschreibt Variante
A+B zusammen, klingt aber nach dem illegalen Pool.

---

## 4. Risiko-Flags aus der Parallel-Arbeit (an die Agenten zurückspielen)

1. **`legal-brain` Flow 2–4 (Gegner-Analyse):** Datenquelle MUSS auf öffentliche
   Quellen + eigene Fälle der JEWEILIGEN Kanzlei beschränkt werden (Variante A+B).
   Kein Cross-Tenant-Read, auch nicht „anonymisiert". Source-Isolation-Invariante
   gilt auch hier (`sourceScopeOpts`).
2. **Anonymizer-Begriff:** HMAC = Pseudonymisierung, nicht Anonymisierung. Doku +
   Blueprint-Sprache korrigieren, sonst ist die DSGVO-Selbstbeschreibung angreifbar.
3. **„Chancen-Bewertung / Strategieempfehlung":** Als Werkzeug FÜR Anwälte ok
   (kein RDG-Verstoß), aber Output braucht den Disclaimer-Standard aus
   deadline-extract: nie autoritativ, immer „professionell verifizieren".
4. **Konnektoren + geteilte Brains:** ACL-Vererbung ungelöst (§2b). Bis dahin:
   Konnektoren nur in Single-User-Brains dokumentieren/erzwingen.
5. **Neue Module ohne Tests:** `src/core/legal/`, 9 Konnektoren (nur nl-console hat
   Tests). Vor Ship: Test-Pflicht gemäß Repo-Konvention.
6. **Medical-Pack (`gbrain-medical.yaml`):** Öffnet Gesundheitsdaten-Vertikale =
   DSGVO Art. 9. Nicht bewerben, bevor AVV/TOMs dafür stehen (K8: Fokus halten!).

---

## 5. Bau-Reihenfolge (kondensiert)

1. **P0 — SaaS-Launchpfad** (unverändert K1): Provisioning, Billing-Keys, Domain.
   Ohne das ist jede weitere Feature-Arbeit Fassade.
2. **P1 — Vertrauen + Stickiness im Wedge:** Zitat-Sprung-UI, Usage-Meter,
   SSO-Minimum (Google/Microsoft OAuth fürs Team-Tier), Outlook/M365-Konnektor,
   ACL-Entscheidung, legal-brain auf Variante-A/B-Leitplanken + Tests.
3. **P2 — Enterprise-Tür + DACH-Differenzierung:** DATEV-Brücke (V1 = Export-Dateien
   durch bestehende Pipeline), Public-Law-Brain (Variante B), Audit-Hash-Kette,
   eigene VLAIR-artige Eval, beA/e-Akte-Konzept, SOC2-Roadmap.
4. **P3 — nach Traktion:** Konnektoren-Katalog-Ausbau, Browser/Slack-Surfaces,
   Store-Apps, weitere Vertikale (Versicherung, Family Office).

---

## 6. Enterprise-Readiness-Vergleich (Juni 2026, Runde 4) — Verwaltungsschicht vs. die Besten

**Die Messlatte (Glean-Admin-Console + 2026er „Table Stakes"-Konsens):** SSO (SAML/OIDC),
SCIM-Provisioning, MFA, org-gescopte RBAC (Gruppen als Principals, 4 Rollen-Stufen),
manipulationssichere + exportierbare Audit-Logs, Team-Invites + Seat-Verwaltung,
Billing auf Org-Ebene, Usage-Metering.

**Ehrliches Urteil in zwei Hälften:**

- **Engine/Code-Tiefe: Marktspitze, ja.** Tausende Tests, CI-Guards, Engine-Parität,
  fuzz-getestete Source-Isolation, Open Source — diese Engineering-Disziplin hat in
  der Kategorie niemand öffentlich nachweisbar. Retrieval+Graph+Gap-Analyse: führend.
- **SaaS-Verwaltungsschicht: solide V1, NICHT Glean-Niveau — und das ist ok.**
  Erste-10-Kunden-ready: ja. Enterprise-Procurement-ready: nein. Der Abstand ist
  benannt, nicht schöngeredet:

| Enterprise-Feature | Wir | Lösungsweg + Aufwand |
|---|---|---|
| **Team/Org-Modell + Invites** | ❌ GRÖSSTE LÜCKE: Team-Plan wird verkauft (5 Seats), aber kein Invite-Flow, keine Org-Entität — jeder User hat 1:1 sein Brain | Eigenbau, ~1–2 Sessions: Org-Entity im User-Store, Invite per Action-Token (tokens.ts + mail.ts EXISTIEREN schon), Team-Brain = Org-brainId statt User-brainId. VOR dem ersten Team-Kunden bauen |
| SSO (SAML/OIDC) + SCIM | ❌ | NICHT selbst bauen: WorkOS/AuthKit (Industrie-Standardweg, Tage statt Wochen). Ab erstem Enterprise-Lead |
| MFA/2FA | ❌ | Kommt mit WorkOS mit; Eigenbau (TOTP) wäre ~1 Session, aber WorkOS-Weg vermeidet Doppelarbeit |
| Kunden-Audit-Log (export.) | 🟡 Engine loggt (mcp_request_log), kein Tenant-UI/Export | Source-Spalte ins Log + Dashboard-Seite + CSV-Export, ~1 Session. Hash-Kette (Subsumio-Idee) fürs Enterprise-Tier obendrauf |
| Org-gescopte RBAC | 🟡 global user/admin | Mit dem Org-Modell zusammen bauen (member/admin/owner pro Org reicht für Team-Tier; Glean-Granularität erst bei Enterprise) |
| Usage-Metering im Dashboard | ❌ versprochen im Pricing („Live-Verbrauchsanzeige")! | Query-Counter je Source existiert implizit (Log) — Karte im Dashboard, ~½ Session. VOR Billing-Live bauen, sonst bricht das Pricing-Versprechen |
| Onboarding/Demo-Brain | ❌ (Pre-Mortem K7) | Seed-Source `demo` read-only je Neukunde mounten, ~1 Session |
| A11y-CI (axe-core) | ❌ (manuell auditiert) | GitHub-Action + axe auf Build, ~Stunden |

**Bau-Reihenfolge der Lösungswege:** (1) Usage-Meter [Pricing-Versprechen],
(2) Org/Team + Invites [verkaufter Plan], (3) Demo-Brain [K7], (4) Audit-Log-UI,
(5) WorkOS-Integration ab erstem Enterprise-Lead, (6) axe-CI jederzeit nebenbei.

Quellen Runde 4: Glean-Admin-Doku (docs.glean.com/administration), WorkOS
Enterprise-Readiness-Checklist 2026 (workos.com/blog/enterprise-readiness-checklist-2026).

## Quellen

Markt-Daten: siehe `SIGMABRAIN_STRATEGIE.md` §4–4b und `web/src/content/compare.ts`
(sources[]). Rechtliche Einordnung §203/Pseudonymisierung: BStBK-FAQ KI (Jan. 2026),
DSGVO Art. 4 Nr. 5 (Pseudonymisierung), Erwägungsgrund 26 (Anonymisierung).
