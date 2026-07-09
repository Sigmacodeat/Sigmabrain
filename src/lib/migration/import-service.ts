/**
 * WP-410: Migration Framework v1 — Import Service.
 *
 * Import pipeline for Notion, Obsidian, and Confluence.
 *
 * APIs:
 *   previewImport(config)  — dry-run: normalize and report without writing
 *   runImport(config)      — full import with normalization and report
 *   getImportReport(id)    — retrieve import report
 *   listImportReports()    — list all import reports
 *   cancelImport(id)       — cancel a running import
 */

import type {
  ImportConfig,
  ImportItem,
  ImportReport,
  ImportReportItem,
  NormalizedRecord,
} from "./types";
import { normalizeBatch } from "./normalization";

const reports: Map<string, ImportReport> = new Map();

function generateReportId(): string {
  return `import_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function isItemSupported(item: ImportItem, config: ImportConfig): boolean {
  // Check file extension filter for file-based sources
  if (config.options.extensions && config.options.extensions.length > 0) {
    const ext = item.sourceId.split(".").pop()?.toLowerCase();
    if (!ext || !config.options.extensions.includes(ext)) {
      return false;
    }
  }
  // Items without content are unsupported
  if (!item.content || item.content.trim() === "") {
    return false;
  }
  return true;
}

export const importService = {
  /**
   * Preview an import: normalize items but don't write to brain.
   * Returns a report with what would be imported.
   */
  async previewImport(
    config: ImportConfig,
    items: ImportItem[],
  ): Promise<{ report: ImportReport; normalized: NormalizedRecord[] }> {
    const reportId = generateReportId();
    const report: ImportReport = {
      id: reportId,
      config,
      status: "previewing",
      startedAt: new Date().toISOString(),
      totalItems: items.length,
      importedItems: 0,
      skippedItems: 0,
      failedItems: 0,
      unsupportedItems: 0,
      items: [],
    };

    const supported = items.filter((item) => {
      if (!isItemSupported(item, config)) {
        report.unsupportedItems++;
        report.items.push({
          sourceId: item.sourceId,
          title: item.title,
          status: "unsupported",
          sourceUrl: item.sourceUrl,
          reason: "Unsupported format or empty content",
        });
        return false;
      }
      return true;
    });

    const normalized = normalizeBatch(supported, config.source);

    for (let i = 0; i < normalized.length; i++) {
      const record = normalized[i];
      const originalItem = supported[i];
      report.importedItems++;
      report.items.push({
        sourceId: originalItem.sourceId,
        title: record.title,
        status: "imported",
        slug: record.slug,
        sourceUrl: record.sourceUrl,
      });
    }

    report.status = "completed";
    report.completedAt = new Date().toISOString();
    reports.set(reportId, report);

    return { report, normalized };
  },

  /**
   * Run a full import: normalize and "write" to brain.
   * In production, this would call api.brain.createPage for each record.
   * Here we simulate the write and produce a report.
   */
  async runImport(
    config: ImportConfig,
    items: ImportItem[],
  ): Promise<{ report: ImportReport; records: NormalizedRecord[] }> {
    const reportId = generateReportId();
    const report: ImportReport = {
      id: reportId,
      config,
      status: "running",
      startedAt: new Date().toISOString(),
      totalItems: items.length,
      importedItems: 0,
      skippedItems: 0,
      failedItems: 0,
      unsupportedItems: 0,
      items: [],
    };
    reports.set(reportId, report);

    const records: NormalizedRecord[] = [];
    const maxItems = config.options.maxItems ?? 0;
    let processed = 0;

    for (const item of items) {
      // Check maxItems limit
      if (maxItems > 0 && processed >= maxItems) {
        report.skippedItems++;
        report.items.push({
          sourceId: item.sourceId,
          title: item.title,
          status: "skipped",
          reason: "maxItems limit reached",
        });
        continue;
      }

      // Check if supported
      if (!isItemSupported(item, config)) {
        report.unsupportedItems++;
        report.items.push({
          sourceId: item.sourceId,
          title: item.title,
          status: "unsupported",
          sourceUrl: item.sourceUrl,
          reason: "Unsupported format or empty content",
        });
        continue;
      }

      // Normalize
      try {
        const { normalizeItem } = await import("./normalization");
        const record = normalizeItem(item, config.source);
        records.push(record);
        report.importedItems++;
        report.items.push({
          sourceId: item.sourceId,
          title: record.title,
          status: "imported",
          slug: record.slug,
          sourceUrl: record.sourceUrl,
        });
        processed++;
      } catch (err) {
        if (config.options.skipErrors) {
          report.failedItems++;
          report.items.push({
            sourceId: item.sourceId,
            title: item.title,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        } else {
          report.status = "failed";
          report.error = err instanceof Error ? err.message : String(err);
          report.completedAt = new Date().toISOString();
          reports.set(reportId, report);
          throw err;
        }
      }
    }

    report.status = "completed";
    report.completedAt = new Date().toISOString();
    reports.set(reportId, report);

    return { report, records };
  },

  /**
   * Get an import report by ID.
   */
  getImportReport(id: string): ImportReport | undefined {
    return reports.get(id);
  },

  /**
   * List all import reports.
   */
  listImportReports(): ImportReport[] {
    return Array.from(reports.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  /**
   * Cancel a running import.
   */
  cancelImport(id: string): void {
    const report = reports.get(id);
    if (!report) throw new Error(`import_not_found: ${id}`);
    if (report.status !== "running" && report.status !== "previewing") {
      throw new Error(`import_not_running: ${report.status}`);
    }
    report.status = "cancelled";
    report.completedAt = new Date().toISOString();
    reports.set(id, report);
  },

  /**
   * Clear all reports (for testing).
   */
  clear(): void {
    reports.clear();
  },
};
