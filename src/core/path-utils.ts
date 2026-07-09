export function canonicalizePath(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("INVALID_PATH: path must be a non-empty string");
  }

  const normalized = input.trim();

  if (normalized === "") {
    throw new Error("INVALID_PATH: path must not be empty");
  }

  const parts = normalized.split(/[\/\\]/);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (resolved.length === 0) {
        throw new Error("PATH_TRAVERSAL: path escapes root via ..");
      }
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }

  if (resolved.length === 0) {
    throw new Error("INVALID_PATH: path resolves to empty");
  }

  const isWindows = /^[A-Za-z]:/.test(normalized);
  const separator = isWindows ? "\\" : "/";
  const canonical = resolved.join(separator);

  if (isWindows) {
    const drive = normalized.match(/^([A-Za-z]:)/);
    if (drive) {
      return `${drive[1]}\\${canonical}`;
    }
  }

  return (isWindows ? "" : "/") + canonical;
}

export function isPathWithinDirectory(candidate: string, directory: string): boolean {
  try {
    const canonicalCandidate = canonicalizePath(candidate);
    const canonicalDir = canonicalizePath(directory);
    return canonicalCandidate === canonicalDir || canonicalCandidate.startsWith(canonicalDir + "/");
  } catch {
    return false;
  }
}

export function isSymlinkPath(path: string): boolean {
  return path.includes("~") || path.includes("->");
}

export function detectPathTraversal(path: string): boolean {
  if (!path) return false;
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  let depth = 0;
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      depth--;
      if (depth < 0) return true;
    } else {
      depth++;
    }
  }
  return false;
}

export function isValidFolderPath(path: string): boolean {
  try {
    canonicalizePath(path);
    return !detectPathTraversal(path);
  } catch {
    return false;
  }
}
