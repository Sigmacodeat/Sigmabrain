export type DesktopSessionStatus =
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "restoring"
  | "error";

export interface DesktopSessionUser {
  uid: string;
  email: string;
  role: string;
}

export interface DesktopSessionState {
  status: DesktopSessionStatus;
  user: DesktopSessionUser | null;
  token: string | null;
  restoredAt: string | null;
  error: string | null;
}

export interface DesktopLoginCredentials {
  email: string;
  password: string;
}

export interface DesktopLoginResult {
  success: boolean;
  token?: string;
  user?: DesktopSessionUser;
  error?: string;
}

export type DesktopAuthEventName =
  | "desktop-session-started"
  | "desktop-session-restored"
  | "desktop-session-ended";

export interface DesktopAuthEventPayload {
  uid: string;
  email: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

export const SESSION_KEYCHAIN_KEY = "sb_desktop_session";
