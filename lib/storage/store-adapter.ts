import fs from "fs";
import path from "path";
import os from "os";

function getDataDirectory(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production") {
    try {
      const tmpDir = path.join(os.tmpdir(), "webmcp_data");
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch (e) {
      return os.tmpdir();
    }
  }

  const localDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
  } catch (e) {}
  return localDir;
}

function ensureDirectoryExists() {
  const dir = getDataDirectory();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {}
}

const DATA_DIR = getDataDirectory();

export class JsonStorageAdapter {
  private memoryCache: Map<string, any> = new Map();

  constructor() {
    ensureDirectoryExists();
  }

  public read<T>(filename: string, defaultValue: T): T {
    const filePath = path.join(DATA_DIR, filename);
    if (this.memoryCache.has(filename)) {
      return this.memoryCache.get(filename) as T;
    }

    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        this.memoryCache.set(filename, parsed);
        return parsed as T;
      }
    } catch (e) {
      console.warn(`Error reading ${filename}, fallback to default:`, e);
    }

    this.memoryCache.set(filename, defaultValue);
    return defaultValue;
  }

  public write<T>(filename: string, data: T): boolean {
    const filePath = path.join(DATA_DIR, filename);
    this.memoryCache.set(filename, data);

    try {
      ensureDirectoryExists();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      return true;
    } catch (e) {
      console.warn(`Error writing ${filename} to disk, cached in memory only:`, e);
      return false;
    }
  }
}

export const storage = new JsonStorageAdapter();