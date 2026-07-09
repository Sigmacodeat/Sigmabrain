export type ShellPlatform = "macos" | "windows" | "linux";

export type ShellEventName =
  | "desktop-shell-started"
  | "desktop-shell-ready"
  | "desktop-shell-closing";

export interface ShellInfo {
  version: string;
  platform: string;
  timestamp: string;
}

export interface ShellReadyPayload {
  window_title: string;
  timestamp: string;
}

export type ShellStatus = "initializing" | "started" | "ready" | "closing" | "closed";

export interface ShellLifecycleHooks {
  onShellStarted?: (info: ShellInfo) => void;
  onShellReady?: (payload: ShellReadyPayload) => void;
  onShellClosing?: () => void;
}

export interface DesktopShellState {
  status: ShellStatus;
  info: ShellInfo | null;
  readyPayload: ShellReadyPayload | null;
  isDesktop: boolean;
}
