export { useAuthStore } from "./store";
export { authService, DesktopAuthService } from "./auth-service";
export { onSessionStarted, onSessionRestored, onSessionEnded } from "./events";
export { useDesktopAuth } from "./use-auth";
export type {
  DesktopSessionStatus,
  DesktopSessionUser,
  DesktopSessionState,
  DesktopLoginCredentials,
  DesktopLoginResult,
  DesktopAuthEventName,
  DesktopAuthEventPayload,
} from "@/core/session-types";
