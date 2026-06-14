"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  Printer,
  Mail,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { STATUS_TEXT, STATUS_BG, statusBadgeClasses, type StatusColor } from "@/lib/status-colors";
import { caseFrontmatter, invoiceFrontmatter, type ExpenseEntry, type InvoiceExpenseEntry, type TimeEntry } from "@/lib/legal-types";
import { sha256Hex, gobdFrontmatter, invoiceContentString } from "@/lib/gobd";
import { loadKanzleiSettings, type KanzleiSettings } from "@/lib/kanzlei-settings";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { calculateRvg, type RvgResult } from "@/lib/rvg";
import { OFFLINE_KEYS, enqueueMutation, getCache, isOnline, setCache } from "@/lib/offline-store";

interface InvoiceItem {
  description: string;
  date: string;
  hours: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  number: string;
  client: string;
  clientSlug?: string;
  clientAddress?: string;
  caseNumber?: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  expenses: InvoiceExpenseEntry[];
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subtotal: number;
  expenseTotal: number;
  advancePayment: number;
  paidAmount?: number;
  paidAt?: string;
  vatRate: number;
  tax: number;
  total: number;
  paymentTerms?: string;
  bank?: {
    name?: string;
    iban?: string;
    bic?: string;
  };
  notes?: string;
  reminderCount?: number;
  reminderSentAt?: string[];
  reminderFee?: number;
  invoiceType?: "standard" | "teilrechnung" | "sammelrechnung" | "gutschrift";
  parentInvoiceId?: string;
  caseSlugs?: string[];
}

interface InvoiceCase {
  slug: string;
  title: string;
  caseNumber: string;
  clientName?: string;
  clientSlug?: string;
  timeEntries?: TimeEntry[];
  expenses?: ExpenseEntry[];
}

interface InvoicingCache {
  invoices: Invoice[];
  cases: InvoiceCase[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: StatusColor }> = {
  draft: { label: "Entwurf", icon: Clock, color: "gray" },
  sent: { label: "Gesendet", icon: Send, color: "blue" },
  paid: { label: "Bezahlt", icon: CheckCircle2, color: "emerald" },
  overdue: { label: "Überfällig", icon: AlertTriangle, color: "red" },
  cancelled: { label: "Storniert", icon: XCircle, color: "gray" },
};

/** Escape user input before injecting into HTML strings — prevents XSS. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlLines(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

/**
 * Fortlaufende Rechnungsnummer pro Jahr (§ 14 Abs. 4 Nr. 4 UStG verlangt
 * einmalige, fortlaufende Nummern — Zufallsnummern sind unzulässig).
 * Die nächste Nummer wird aus den bereits im Brain gespeicherten Rechnungen
 * des laufenden Jahres abgeleitet: R-<Jahr>-<lfd. Nr., 4-stellig>.
 */
function nextInvoiceNumber(existing: Invoice[]): string {
  const year = new Date().getFullYear();
  const prefix = `R-${year}-`;
  let maxSeq = 0;
  for (const inv of existing) {
    if (typeof inv.number === "string" && inv.number.startsWith(prefix)) {
      const seq = parseInt(inv.number.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cases, setCases] = useState<InvoiceCase[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCase, setSelectedCase] = useState("");
  const [invoiceType, setInvoiceType] = useState<Invoice["invoiceType"]>("standard");
  const [advancePayment, setAdvancePayment] = useState("");
  const [loading, setLoading] = useState(true);
  const [kanzlei, setKanzlei] = useState<KanzleiSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("lawyer");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data?.user?.role) setUserRole(data.user.role); })
      .catch(() => {});
    loadKanzleiSettings().then(setKanzlei).catch(() => {});
    loadInvoices();
    loadCases();
  }, []);

  async function loadInvoices() {
    try {
      const pages = await api.brain.listPages({ type: "invoice" });
      const loaded: Invoice[] = pages.map((p) => {
        const fm = invoiceFrontmatter(p);
        return {
          id: p.slug,
          number: fm.invoice_number || p.slug,
          client: fm.client || "",
          clientSlug: fm.client_slug,
          clientAddress: fm.client_address,
          caseNumber: fm.case_number,
          date: fm.date || p.created_at,
          dueDate: fm.due_date || "",
          items: fm.items || [],
          expenses: fm.expenses || [],
          status: (fm.status as Invoice["status"]) || "draft",
          subtotal: fm.subtotal || 0,
          expenseTotal: fm.expense_total || 0,
          advancePayment: fm.advance_payment || 0,
          paidAmount: fm.paid_amount,
          paidAt: fm.paid_at,
          vatRate: fm.vat_rate ?? 0.19,
          tax: fm.tax || 0,
          total: fm.total || 0,
          paymentTerms: fm.payment_terms,
          bank: fm.bank,
          notes: fm.notes,
          reminderCount: fm.reminder_count,
          reminderSentAt: fm.reminder_sent_at,
          reminderFee: fm.reminder_fee,
          invoiceType: fm.invoice_type,
          parentInvoiceId: fm.parent_invoice_id,
          caseSlugs: fm.case_slugs,
        };
      });
      setInvoices(loaded);
      await setCache<InvoicingCache>(OFFLINE_KEYS.invoices, { invoices: loaded, cases });
    } catch (err) {
      console.error("[invoicing] failed to load invoices:", err instanceof Error ? err.message : String(err));
      const cached = await getCache<InvoicingCache>(OFFLINE_KEYS.invoices);
      if (cached) {
        setInvoices(cached.invoices);
        setCases(cached.cases);
        setStatusMessage("Cloud-Brain gerade nicht erreichbar. Es werden zwischengespeicherte Rechnungen angezeigt.");
      } else {
        setInvoices([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadCases() {
    try {
      const pages = await api.brain.listPages({ type: "legal_case" });
      const loadedCases = pages.map((p) => {
        const fm = caseFrontmatter(p);
        return {
          slug: p.slug,
          title: p.title,
          caseNumber: fm.case_number || p.slug,
          clientName: fm.client_name,
          clientSlug: fm.client_slug,
          timeEntries: fm.time_entries || [],
          expenses: fm.expenses || [],
        };
      });
      setCases(loadedCases);
      await setCache<InvoicingCache>(OFFLINE_KEYS.invoices, { invoices, cases: loadedCases });
    } catch (err) {
      console.error("[invoicing] failed to load cases:", err instanceof Error ? err.message : String(err));
      const cached = await getCache<InvoicingCache>(OFFLINE_KEYS.invoices);
      setCases(cached?.cases ?? []);
    }
  }

  async function createInvoice() {
    const c = cases.find((ca) => ca.slug === selectedCase);
    if (!c) return;

    const settings = kanzlei ?? await loadKanzleiSettings();
    let clientAddress: string | undefined;
    if (c.clientSlug) {
      try {
        const page = await api.brain.getPage(c.clientSlug);
        const fm = page.frontmatter as Record<string, unknown>;
        const addr = String(fm.address ?? "");
        const company = String(fm.company ?? "");
        const name = String(fm.name ?? c.clientName ?? "");
        clientAddress = [name, company, addr].filter(Boolean).join("\n");
      } catch (err) {
        console.error("[invoice-create] failed to load contact:", err instanceof Error ? err.message : String(err));
      }
    }
    const defaultRate = parseInt(settings?.stundensatz || "200", 10);
    const billableTime = (c.timeEntries ?? []).filter((entry) => entry.billable !== false && !entry.billed);
    const billableExpenses = (c.expenses ?? []).filter((entry) => entry.billable !== false && !entry.billed);
    if (billableTime.length === 0 && billableExpenses.length === 0) return;

    const items: InvoiceItem[] = billableTime.map((entry) => {
      const hours = entry.minutes / 60;
      const rate = entry.rate || defaultRate;
      return {
        description: entry.description,
        date: entry.date.split("T")[0],
        hours: Math.round(hours * 100) / 100,
        rate,
        amount: Math.round(hours * rate * 100) / 100,
      };
    });
    const expenses: InvoiceExpenseEntry[] = billableExpenses.map((entry) => ({
      description: entry.description,
      date: entry.date.split("T")[0],
      amount: entry.amount,
    }));

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const expenseTotal = expenses.reduce((s, i) => s + i.amount, 0);
    const parsedAdvance = Math.max(0, parseFloat(advancePayment) || 0);
    // RATG = Austria (20% VAT), RVG/custom = Germany (19% VAT)
    const vatRate = settings?.tarifModell === "ratg" ? 0.20 : 0.19;
    const taxableBase = subtotal + expenseTotal;
    const tax = Math.round(taxableBase * vatRate * 100) / 100;
    const total = Math.max(0, Math.round((taxableBase + tax - parsedAdvance) * 100) / 100);
    const paymentDays = Math.max(1, parseInt(settings?.zahlungszielTage || "14", 10) || 14);

    const invoice: Invoice = {
      id: `invoice/${Date.now()}`,
      number: nextInvoiceNumber(invoices),
      client: c.clientName || "Unbekannter Mandant",
      clientSlug: c.clientSlug,
      clientAddress,
      caseNumber: c.caseNumber,
      date: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + paymentDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      items,
      expenses,
      status: "draft",
      subtotal,
      expenseTotal,
      advancePayment: parsedAdvance,
      vatRate,
      tax,
      total,
      paymentTerms: `${paymentDays} Tage netto`,
      bank: {
        name: settings?.bankName,
        iban: settings?.iban,
        bic: settings?.bic,
      },
      notes: `Rechnung für Akte ${c.caseNumber}`,
    };

    // GoBD-Baustein: Manipulations-Evidenz über die belegrelevanten Felder.
    // Eine spätere Änderung an Nummer/Betrag/Positionen ändert den Hash, die
    // Unveränderbarkeit wird so nachprüfbar (§ 146 Abs. 4 AO, GoBD Rz. 107 ff.).
    const issuedAt = new Date();
    const hash = await sha256Hex(invoiceContentString(invoice));

    try {
      const invoicePayload = {
        slug: invoice.id,
        title: `Rechnung ${invoice.number}`,
        type: "invoice",
        frontmatter: {
          type: "invoice",
          invoice_number: invoice.number,
          client: invoice.client,
          client_slug: invoice.clientSlug,
          client_address: invoice.clientAddress,
          case_number: invoice.caseNumber,
          date: invoice.date,
          due_date: invoice.dueDate,
          items: invoice.items,
          expenses: invoice.expenses,
          status: invoice.status,
          subtotal: invoice.subtotal,
          expense_total: invoice.expenseTotal,
          advance_payment: invoice.advancePayment,
          vat_rate: invoice.vatRate,
          tax: invoice.tax,
          total: invoice.total,
          payment_terms: invoice.paymentTerms,
          bank: invoice.bank,
          notes: invoice.notes,
          invoice_type: invoiceType,
          ...gobdFrontmatter(hash, issuedAt),
        },
      };
      if (isOnline()) {
        await api.brain.createPage(invoicePayload);
      } else {
        await enqueueMutation({ type: "createPage", payload: invoicePayload });
      }
      const billedTimeIds = new Set(billableTime.map((entry) => entry.id));
      const billedExpenseIds = new Set(billableExpenses.map((entry) => entry.id));
      const updatedTimeEntries = (c.timeEntries ?? []).map((entry) =>
        billedTimeIds.has(entry.id) ? { ...entry, billed: true, invoice_number: invoice.number } : entry,
      );
      const updatedExpenses = (c.expenses ?? []).map((entry) =>
        billedExpenseIds.has(entry.id) ? { ...entry, billed: true, invoice_number: invoice.number } : entry,
      );
      const caseUpdatePayload = {
        slug: c.slug,
        frontmatter: {
          time_entries: updatedTimeEntries,
          expenses: updatedExpenses,
        },
      };
      if (isOnline()) {
        await api.brain.updatePage(caseUpdatePayload);
      } else {
        await enqueueMutation({ type: "updatePage", payload: caseUpdatePayload });
      }
      const nextInvoices = [invoice, ...invoices];
      const nextCases = cases.map((ca) => ca.slug === c.slug ? { ...ca, timeEntries: updatedTimeEntries, expenses: updatedExpenses } : ca);
      setInvoices(nextInvoices);
      setCases(nextCases);
      await setCache<InvoicingCache>(OFFLINE_KEYS.invoices, { invoices: nextInvoices, cases: nextCases });
      setShowCreate(false);
      setSelectedCase("");
      setAdvancePayment("");
    } catch (err) {
      console.error("[invoicing] failed to create invoice:", err instanceof Error ? err.message : String(err));
    }
  }

  async function printInvoice(inv: Invoice) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const settings = kanzlei ?? await loadKanzleiSettings();
    const vatRate = inv.vatRate || (settings?.tarifModell === "ratg" ? 0.20 : 0.19);
    const html = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Rechnung ${inv.number}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #333; font-size: 14px; }
  .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { margin: 0; font-size: 28px; color: #6366f1; }
  .header p { margin: 4px 0; color: #666; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .meta-box { background: #f8f9fa; padding: 15px; border-radius: 8px; }
  .meta-box strong { display: block; margin-bottom: 8px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #f1f3f4; padding: 12px; text-align: left; font-weight: 600; }
  td { padding: 12px; border-bottom: 1px solid #e8eaed; }
  .right { text-align: right; }
  .totals { margin-top: 20px; border-top: 2px solid #e8eaed; padding-top: 20px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
  .total-row.grand { font-size: 18px; font-weight: bold; color: #6366f1; border-top: 2px solid #6366f1; margin-top: 10px; padding-top: 15px; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e8eaed; font-size: 12px; color: #666; }
  .muted { color: #666; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>Rechnung</h1>
    <p><strong>${escapeHtml(settings?.kanzleiName || "Kanzlei")}</strong></p>
    <p>${escapeHtml(settings?.anwaltName || "")}</p>
    ${settings?.kanzleiAdresse ? `<p>${escapeHtmlLines(settings.kanzleiAdresse)}</p>` : ""}
    ${settings?.kanzleiEmail || settings?.kanzleiTelefon ? `<p>${escapeHtml([settings?.kanzleiEmail, settings?.kanzleiTelefon].filter(Boolean).join(" · "))}</p>` : ""}
    ${settings?.kammerNummer ? `<p>${escapeHtml(settings.kammerNummer)}</p>` : ""}
    ${settings?.ustId ? `<p>USt-ID: ${escapeHtml(settings.ustId)}</p>` : ""}
  </div>

  <div class="meta">
    <div class="meta-box">
      <strong>Rechnung an:</strong>
      ${escapeHtml(inv.client)}
    </div>
    <div class="meta-box">
      <strong>Rechnungsdetails:</strong>
      <p>Rechnungs-Nr.: ${escapeHtml(inv.number)}</p>
      <p>Datum: ${escapeHtml(inv.date)}</p>
      <p>Fällig: ${escapeHtml(inv.dueDate)}</p>
      ${inv.caseNumber ? `<p>Aktenzeichen: ${escapeHtml(inv.caseNumber)}</p>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Datum</th>
        <th>Beschreibung</th>
        <th class="right">Stunden</th>
        <th class="right">Satz (€)</th>
        <th class="right">Betrag (€)</th>
      </tr>
    </thead>
    <tbody>
      ${inv.items.map((item) => `
        <tr>
          <td>${escapeHtml(item.date)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="right">${item.hours.toFixed(2)}</td>
          <td class="right">${item.rate.toFixed(2)}</td>
          <td class="right">${item.amount.toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  ${inv.expenses.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Datum</th>
          <th>Auslage</th>
          <th class="right">Betrag (€)</th>
        </tr>
      </thead>
      <tbody>
        ${inv.expenses.map((item) => `
          <tr>
            <td>${escapeHtml(item.date)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td class="right">${item.amount.toFixed(2)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : ""}

  <div class="totals">
    <div class="total-row"><span>Honorar netto</span><span>${inv.subtotal.toFixed(2)} €</span></div>
    ${inv.expenseTotal > 0 ? `<div class="total-row"><span>Auslagen netto</span><span>${inv.expenseTotal.toFixed(2)} €</span></div>` : ""}
    <div class="total-row"><span>Mehrwertsteuer (${(vatRate * 100).toFixed(0)}%)</span><span>${inv.tax.toFixed(2)} €</span></div>
    ${inv.advancePayment > 0 ? `<div class="total-row"><span>Vorschuss / Anzahlung</span><span>- ${inv.advancePayment.toFixed(2)} €</span></div>` : ""}
    <div class="total-row grand"><span>Gesamtbetrag</span><span>${inv.total.toFixed(2)} €</span></div>
  </div>

  ${inv.notes ? `<p style="margin-top: 30px; color: #666;">${escapeHtml(inv.notes)}</p>` : ""}

  <div class="footer">
    <p>Zahlungsbedingungen: ${escapeHtml(inv.paymentTerms || "14 Tage netto")}</p>
    ${inv.bank?.iban ? `<p>${escapeHtml([inv.bank.name, inv.bank.iban, inv.bank.bic].filter(Boolean).join(" · "))}</p>` : ""}
    <p>${escapeHtml(settings?.rechnungFooter || "Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.")}</p>
  </div>

  <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  async function downloadPdf(inv: Invoice) {
    const settings = kanzlei ?? await loadKanzleiSettings();
    const pdf = generateInvoicePdf({
      number: inv.number,
      client: inv.client,
      clientAddress: inv.clientAddress,
      caseNumber: inv.caseNumber,
      date: inv.date,
      dueDate: inv.dueDate,
      items: inv.items,
      expenses: inv.expenses,
      subtotal: inv.subtotal,
      expenseTotal: inv.expenseTotal,
      advancePayment: inv.advancePayment,
      vatRate: inv.vatRate,
      tax: inv.tax,
      total: inv.total,
      paymentTerms: inv.paymentTerms,
      bank: inv.bank,
      notes: inv.notes,
      kanzlei: {
        name: settings?.kanzleiName || "Kanzlei",
        anwaltName: settings?.anwaltName,
        adresse: settings?.kanzleiAdresse,
        email: settings?.kanzleiEmail,
        telefon: settings?.kanzleiTelefon,
        kammerNummer: settings?.kammerNummer,
        ustId: settings?.ustId,
      },
    });
    pdf.save(`Rechnung_${inv.number}.pdf`);
  }

  async function sendInvoiceEmail(inv: Invoice) {
    setStatusMessage("E-Mail wird gesendet…");
    try {
      const res = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceSlug: inv.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`E-Mail gesendet an ${data.sentTo}`);
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage(data.error === "smtp_not_configured" ? "SMTP nicht konfiguriert. Bitte in Einstellungen → Kanzlei hinterlegen." : `Fehler: ${data.error}`);
      }
    } catch (err) {
      setStatusMessage("Senden fehlgeschlagen.");
      console.error("[invoice-email] failed:", err instanceof Error ? err.message : String(err));
    }
  }

  async function sendReminder(inv: Invoice) {
    setStatusMessage("Mahnung wird gesendet…");
    try {
      const res = await fetch("/api/invoices/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceSlug: inv.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`${data.reminderCount}. Mahnung gesendet — Gebühr: ${data.fee.toFixed(2)} €`);
        // Refresh invoice list
        await loadInvoices();
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        setStatusMessage(data.error === "smtp_not_configured" ? "SMTP nicht konfiguriert. Bitte in Einstellungen → Kanzlei hinterlegen." : `Fehler: ${data.error}`);
      }
    } catch (err) {
      setStatusMessage("Mahnung fehlgeschlagen.");
      console.error("[invoice-reminder] failed:", err instanceof Error ? err.message : String(err));
    }
  }

  async function updateStatus(inv: Invoice, status: Invoice["status"]) {
    const paidPatch: Pick<Invoice, "paidAt" | "paidAmount"> = status === "paid"
      ? { paidAt: new Date().toISOString(), paidAmount: inv.total }
      : { paidAt: inv.paidAt, paidAmount: inv.paidAmount };
    setStatusMessage(null);
    try {
      const updatePayload = {
        slug: inv.id,
        frontmatter: {
          status,
          ...(status === "paid" ? { paid_at: paidPatch.paidAt, paid_amount: paidPatch.paidAmount } : {}),
        },
      };
      if (isOnline()) {
        await api.brain.updatePage(updatePayload);
      } else {
        await enqueueMutation({ type: "updatePage", payload: updatePayload });
      }
      const nextInvoices = invoices.map((i) => i.id === inv.id ? { ...i, status, ...paidPatch } : i);
      setInvoices(nextInvoices);
      await setCache<InvoicingCache>(OFFLINE_KEYS.invoices, { invoices: nextInvoices, cases });
      setStatusMessage(`Rechnung ${inv.number} wurde aktualisiert.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Status konnte nicht gespeichert werden: ${err.message}` : "Status konnte nicht gespeichert werden.");
    }
  }

  async function deleteInvoice(inv: Invoice) {
    if (!confirm(`Rechnung ${inv.number} wirklich löschen?`)) return;
    try {
      if (isOnline()) {
        await api.brain.deletePage(inv.id);
      } else {
        await enqueueMutation({ type: "deletePage", payload: { slug: inv.id } });
      }
      const nextInvoices = invoices.filter((i) => i.id !== inv.id);
      setInvoices(nextInvoices);
      await setCache<InvoicingCache>(OFFLINE_KEYS.invoices, { invoices: nextInvoices, cases });
      setStatusMessage(`Rechnung ${inv.number} gelöscht.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? `Löschen fehlgeschlagen: ${err.message}` : "Löschen fehlgeschlagen.");
    }
  }

  const filtered = invoices.filter((inv) =>
    inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalOutstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center">
            <FileText size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e8e8f0]">Rechnungen</h1>
            <p className="text-sm text-[#8888aa]">Abrechnung & PDF-Export</p>
          </div>
        </div>
        <Button
          variant="primary"
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? <XCircle size={14} /> : <Plus size={14} />}
          {showCreate ? "Abbrechen" : "Rechnung erstellen"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-3 text-center">
          <div className="text-xs text-[#8a8aa8]">Offen</div>
          <div className="text-xl font-bold text-amber-400">{totalOutstanding.toLocaleString("de-DE")} €</div>
        </div>
        <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-3 text-center">
          <div className="text-xs text-[#8a8aa8]">Bezahlt</div>
          <div className="text-xl font-bold text-emerald-400">{totalPaid.toLocaleString("de-DE")} €</div>
        </div>
        <div className="rounded-xl border border-[#1e1e3a] bg-[#0a0a18] p-3 text-center">
          <div className="text-xs text-[#8a8aa8]">Rechnungen</div>
          <div className="text-xl font-bold text-[#e8e8f0]">{invoices.length}</div>
        </div>
      </div>

      {statusMessage && (
        <div className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          statusMessage.includes("nicht") || statusMessage.includes("fehl")
            ? "border-red-500/20 bg-red-500/5 text-red-300"
            : "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
        )}>
          {statusMessage}
        </div>
      )}

      {/* Create Invoice */}
      {showCreate && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-emerald-400">Rechnung aus Akte erstellen</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8888aa] block mb-1">Akte wählen</label>
                <select
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value)}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">— Akte auswählen —</option>
                  {cases.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.caseNumber} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#8888aa] block mb-1">Rechnungstyp</label>
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value as Invoice["invoiceType"])}
                  className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="standard">Standard</option>
                  <option value="teilrechnung">Teilrechnung</option>
                  <option value="sammelrechnung">Sammelrechnung</option>
                  <option value="gutschrift">Gutschrift</option>
                </select>
              </div>
            </div>
            {selectedCase && (() => {
              const c = cases.find((ca) => ca.slug === selectedCase);
              const openTime = (c?.timeEntries ?? []).filter((entry) => entry.billable !== false && !entry.billed);
              const openExpenses = (c?.expenses ?? []).filter((entry) => entry.billable !== false && !entry.billed);
              if (openTime.length === 0 && openExpenses.length === 0) return (
                <div className="text-sm text-amber-400">Keine offenen abrechenbaren Zeiten oder Auslagen in dieser Akte.</div>
              );
              const totalMinutes = openTime.reduce((s, e) => s + (e.minutes || 0), 0);
              const expenseTotal = openExpenses.reduce((s, e) => s + e.amount, 0);
              return (
                <div className="text-sm text-[#8888aa]">
                  {openTime.length} offene Buchungen · {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}min ·
                  {' '}{openExpenses.length} Auslagen ({expenseTotal.toFixed(2)} €) ·
                  {' '}Honorar geschätzt: {Math.round((totalMinutes / 60) * (parseInt(kanzlei?.stundensatz || "200", 10))).toLocaleString("de-DE")} €
                </div>
              );
            })()}
            <div>
              <label className="text-xs text-[#8888aa] block mb-1">Vorschuss / Anzahlung (€)</label>
              <input
                type="number"
                step="0.01"
                value={advancePayment}
                onChange={(e) => setAdvancePayment(e.target.value)}
                placeholder="0,00"
                className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 text-sm"
                onClick={createInvoice}
                disabled={!selectedCase || (userRole !== "admin" && userRole !== "lawyer")}
                title={userRole !== "admin" && userRole !== "lawyer" ? "Nur Admin oder Anwalt" : ""}
              >
                <FileText size={14} />
                Rechnung erstellen
              </Button>
              <RvgDialog />
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8aa8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechnung suchen…"
          aria-label="Rechnung suchen"
          className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="text-center py-20 text-[#8888aa]">Lade Rechnungen…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <FileText size={48} className="mx-auto text-[#1e1e3a]" />
          <p className="text-[#8888aa]">Noch keine Rechnungen vorhanden.</p>
          <p className="text-[#8a8aa8] text-sm">Erstellen Sie eine Rechnung aus einer Akte mit Zeiterfassung.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const status = STATUS_CONFIG[inv.status];
            const StatusIcon = status.icon;
            return (
              <div
                key={inv.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] hover:bg-[#12122a] transition-all"
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", STATUS_BG[status.color])} aria-hidden="true">
                  <StatusIcon size={18} className={STATUS_TEXT[status.color]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#e8e8f0]">{inv.number}</span>
                    <Badge variant="default" className={cn("text-[10px] border", statusBadgeClasses(status.color))}>
                      {status.label}
                    </Badge>
                    {inv.reminderCount ? (
                      <Badge variant="default" className="text-[10px] border bg-amber-600/15 text-amber-400 border-amber-500/30">
                        {inv.reminderCount}. Mahnung
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-[#8888aa] mt-0.5">
                    {inv.client} · {inv.items.length + inv.expenses.length} Positionen · {inv.date}
                    {inv.paidAt ? ` · bezahlt ${new Date(inv.paidAt).toLocaleDateString("de-DE")}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#e8e8f0]">{inv.total.toFixed(2)} €</div>
                  <div className="text-xs text-[#8a8aa8]">inkl. MwSt.</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => void printInvoice(inv)}
                    className="p-2 rounded-lg text-[#8a8aa8] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                    title="Drucken"
                  >
                    <Printer size={14} />
                  </button>
                  <button
                    onClick={() => void downloadPdf(inv)}
                    className="p-2 rounded-lg text-[#8a8aa8] hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                    title="PDF herunterladen"
                  >
                    <FileText size={14} />
                  </button>
                  {(userRole === "admin" || userRole === "lawyer" || userRole === "assistant") && (
                    <button
                      onClick={() => void sendInvoiceEmail(inv)}
                      className="p-2 rounded-lg text-[#8a8aa8] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                      title="Per E-Mail senden"
                    >
                      <Mail size={14} />
                    </button>
                  )}
                  {inv.status === "draft" && (
                    <button
                      onClick={() => updateStatus(inv, "sent")}
                      className="p-2 rounded-lg text-[#8a8aa8] hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                      title="Als gesendet markieren"
                    >
                      <Send size={14} />
                    </button>
                  )}
                  {inv.status === "sent" && (
                    <button
                      onClick={() => updateStatus(inv, "paid")}
                      className="p-2 rounded-lg text-[#8a8aa8] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                      title="Als bezahlt markieren"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                  {inv.status !== "paid" && inv.status !== "cancelled" && (userRole === "admin" || userRole === "lawyer") && (
                    <button
                      onClick={() => updateStatus(inv, "cancelled")}
                      className="p-2 rounded-lg text-[#8a8aa8] hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Stornieren"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  {(inv.status === "sent" || inv.status === "overdue") && (userRole === "admin" || userRole === "lawyer") && (
                    <button
                      onClick={() => void sendReminder(inv)}
                      className="p-2 rounded-lg text-[#8a8aa8] hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                      title={`${inv.reminderCount ? `${inv.reminderCount}. ` : ""}Mahnung senden`}
                    >
                      <AlertTriangle size={14} />
                    </button>
                  )}
                  {(userRole === "admin" || userRole === "lawyer") && (
                    <button
                      onClick={() => deleteInvoice(inv)}
                      className="p-2 rounded-lg text-[#8a8aa8] hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Löschen"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RvgDialog() {
  const [open, setOpen] = useState(false);
  const [streitwert, setStreitwert] = useState("");
  const [result, setResult] = useState<RvgResult | null>(null);

  return (
    <>
      <Button
        variant="outline"
        className="text-sm border-[#1e1e3a] text-[#8888aa] hover:text-[#e8e8f0] hover:border-[#3a3a6a]"
        onClick={() => setOpen(true)}
      >
        RVG berechnen
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-[#1e1e3a] bg-[#0d0d1a] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#e8e8f0]">RVG-Gebührenberechnung</h3>
            <div>
              <label className="text-xs text-[#8888aa] block mb-1">Streitwert (€)</label>
              <input
                type="number"
                value={streitwert}
                onChange={(e) => {
                  setStreitwert(e.target.value);
                  const sv = parseFloat(e.target.value);
                  if (sv > 0) {
                    setResult(calculateRvg(sv));
                  } else {
                    setResult(null);
                  }
                }}
                placeholder="z. B. 10000"
                className="w-full bg-[#0a0a18] border border-[#1e1e3a] rounded-lg px-3 py-2 text-sm text-[#e8e8f0] placeholder:text-[#8a8aa8] focus:outline-none focus:border-violet-500/50"
              />
            </div>
            {result && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#8888aa]">Basisgebühr (1,0)</span><span className="text-[#e8e8f0]">{result.basisGebuehr.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="text-[#8888aa]">Verfahrensgebühr (1,3)</span><span className="text-[#e8e8f0]">{result.verfahrensgebuehr.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="text-[#8888aa]">Terminsgebühr (1,2)</span><span className="text-[#e8e8f0]">{result.terminsgebuehr.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="text-[#8888aa]">Auslagenpauschale</span><span className="text-[#e8e8f0]">{result.auslagenpauschale.toFixed(2)} €</span></div>
                <div className="flex justify-between border-t border-[#1e1e3a] pt-2"><span className="text-[#8888aa]">Netto</span><span className="text-[#e8e8f0] font-medium">{result.summeNetto.toFixed(2)} €</span></div>
                <div className="flex justify-between"><span className="text-[#8888aa]">MwSt (19 %)</span><span className="text-[#e8e8f0]">{result.mwst.toFixed(2)} €</span></div>
                <div className="flex justify-between text-emerald-400 font-semibold"><span>Brutto</span><span>{result.summeBrutto.toFixed(2)} €</span></div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Schließen</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
