/**
 * Berechtigungs-Matrix für Kanzlei-Rollen.
 * Jede Funktion prüft, ob die gegebene Rolle eine Aktion ausführen darf.
 */

import type { KanzleiRole } from "./auth/store";

export const PERMISSIONS = {
  canCreateInvoice: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer",

  canCancelInvoice: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer",

  canSendInvoice: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer" || role === "assistant",

  canCreateTimeEntry: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer" || role === "assistant",

  canEditDeadlines: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer" || role === "assistant",

  canManageContacts: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer" || role === "assistant",

  canGeneratePortalLink: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer",

  canEditSettings: (role: KanzleiRole) =>
    role === "admin",

  canManageTeam: (role: KanzleiRole) =>
    role === "admin",

  canViewBrain: (role: KanzleiRole) =>
    role !== "client_viewer",

  canUseAI: (role: KanzleiRole) =>
    role === "admin" || role === "lawyer" || role === "assistant",
} as const;
