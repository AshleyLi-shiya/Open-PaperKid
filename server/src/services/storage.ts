import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

/**
 * Tiny JSON-on-disk store, keyed by paper id. No external DB required
 * to keep the project zero-dep beyond what's needed for PDFs / LLMs.
 */
export class Storage {
  private root: string;

  constructor(dir: string = config.storageDir) {
    this.root = path.resolve(dir);
  }

  async init(): Promise<void> {
    await fs.mkdir(path.join(this.root, "pdfs"), { recursive: true });
    await fs.mkdir(path.join(this.root, "papers"), { recursive: true });
    await fs.mkdir(path.join(this.root, "indexes"), { recursive: true });
  }

  paperDir(id: string): string {
    return path.join(this.root, "papers", id);
  }

  pdfPath(id: string): string {
    return path.join(this.root, "pdfs", `${id}.pdf`);
  }

  indexPath(id: string): string {
    return path.join(this.root, "indexes", `${id}.json`);
  }

  async writePaper(id: string, data: unknown): Promise<void> {
    const dir = this.paperDir(id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "paper.json"), JSON.stringify(data, null, 2));
  }

  async readPaper<T = unknown>(id: string): Promise<T | null> {
    const p = path.join(this.paperDir(id), "paper.json");
    try {
      const raw = await fs.readFile(p, "utf-8");
      return JSON.parse(raw) as T;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async listPapers(): Promise<string[]> {
    const dir = path.join(this.root, "papers");
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async deletePaper(id: string): Promise<void> {
    const dir = this.paperDir(id);
    const pdf = this.pdfPath(id);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(pdf, { force: true });
  }

  status(): { storageDir: string; paperCount: number } {
    return { storageDir: this.root, paperCount: -1 };
  }
}

export const storage = new Storage();