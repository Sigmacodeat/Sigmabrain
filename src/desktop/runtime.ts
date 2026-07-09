import { invoke } from "@tauri-apps/api/core";
import type { ShellInfo, ShellReadyPayload } from "./types";

export async function getShellInfo(): Promise<ShellInfo> {
  return invoke<ShellInfo>("get_shell_info");
}

export async function notifyShellReady(): Promise<ShellReadyPayload> {
  return invoke<ShellReadyPayload>("shell_ready");
}

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getPlatform(): Promise<string> {
  const { platform } = await import("@tauri-apps/plugin-os");
  return platform();
}

export async function setWindowTitle(title: string): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}
