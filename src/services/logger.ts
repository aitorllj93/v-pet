import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { LOG_FILENAME, LOG_FLUSH_INTERVAL_MS, LOG_MAX_FILES, LOG_MAX_SIZE_BYTES, NAMESPACE } from "../constants";
import { ACHIEVEMENT_UNLOCKED, ACTIVE, DIAGNOSTICS_CHANGED, EXPERIENCE_ADDED, FILE_CHANGED, FILE_SAVED, GIT_BRANCH_CREATED, GIT_COMMIT, GIT_MERGE, NAVIGATION, PET_EVOLVED, PET_LOADED, ServerMessage, TERMINAL_COMMAND_EXECUTED, TERMINAL_TESTS_PASSED } from "../types";

type LoggerOptions = {
  fileName?: string;
  maxSizeBytes?: number;
  maxFiles?: number;
  flushIntervalMs?: number;
};

export class Logger implements vscode.Disposable {
  private readonly filePath: string;
  private readonly maxSizeBytes: number;
  private readonly maxFiles: number;
  private readonly flushIntervalMs: number;

  private output?: vscode.OutputChannel;

  private stream: fs.WriteStream | null = null;
  private currentSize = 0;

  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;
  private rotateAfterFlush = false;
  private disposed = false;

  constructor(
    context: vscode.ExtensionContext,
    options: LoggerOptions = {}
  ) {
    this.output = vscode.window.createOutputChannel(NAMESPACE);
    const dir = context.globalStorageUri.fsPath;

    this.filePath = path.join(dir, options.fileName ?? LOG_FILENAME);
    this.maxSizeBytes = options.maxSizeBytes ?? LOG_MAX_SIZE_BYTES;
    this.maxFiles = Math.max(1, options.maxFiles ?? LOG_MAX_FILES);
    this.flushIntervalMs = options.flushIntervalMs ?? LOG_FLUSH_INTERVAL_MS;

    fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.filePath)) {
      this.currentSize = fs.statSync(this.filePath).size;
    }

    this.openStream();
    this.startFlushTimer();

    this.info(`Writing log file at "${this.filePath}"`);
  }

  logFromMessage(message: ServerMessage): void {
    const lines = this.linesFromMessage(message);

    for (const line of lines) {
      this.log(line);
    }
  }

  log(message: string): void {
    const line = `[${new Date().toISOString()}] ${message}`;

    if (this.output) {
      this.output.appendLine(line);
    }

    const fileLine = line + "\n";
    const lineBytes = Buffer.byteLength(fileLine);

    if (this.currentSize + this.bufferedBytes() + lineBytes > this.maxSizeBytes) {
      this.rotateAfterFlush = true;
    }

    this.buffer.push(fileLine);
  }

  info(message: string): void {
    this.log(`[INFO] ${message}`);
  }

  warn(message: string): void {
    this.log(`[WARN] ${message}`);
  }

  error(message: string | Error): void {
    if (message instanceof Error) {
      this.log(`[ERROR] ${message.name}: ${message.message}\n${message.stack ?? ""}`);
      return;
    }

    this.log(`[ERROR] ${message}`);
  }

  async flush(): Promise<void> {
    if (this.disposed || this.flushing || this.buffer.length === 0) {
      return;
    }

    this.flushing = true;

    const chunk = this.buffer.join("");
    this.buffer = [];

    try {
      if (this.rotateAfterFlush) {
        await this.rotate();
      }

      await this.writeToStream(chunk);
      this.currentSize += Buffer.byteLength(chunk);
    } catch (err) {
      console.error("[RotatingBufferedLogger] flush failed:", err);

      // Reinyectar el chunk si falla, para no perderlo
      this.buffer.unshift(chunk);
    } finally {
      this.flushing = false;

      // Por si entraron logs mientras hacíamos flush
      if (!this.disposed && this.buffer.length > 0) {
        queueMicrotask(() => {
          void this.flush();
        });
      }
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    const remaining = this.buffer.join("");
    this.buffer = [];

    if (remaining && this.stream) {
      try {
        this.stream.write(remaining);
        this.currentSize += Buffer.byteLength(remaining);
      } catch (err) {
        console.error("[RotatingBufferedLogger] final write failed:", err);
      }
    }

    if (this.stream) {
      try {
        this.stream.end();
      } catch (err) {
        console.error("[RotatingBufferedLogger] stream end failed:", err);
      } finally {
        this.stream = null;
      }
    }
  }

  private openStream(): void {
    this.stream = fs.createWriteStream(this.filePath, { flags: "a" });
    this.stream.on("error", (err) => {
      console.error("[RotatingBufferedLogger] stream error:", err);
    });
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  private bufferedBytes(): number {
    let total = 0;
    for (const item of this.buffer) {
      total += Buffer.byteLength(item);
    }
    return total;
  }

  private async writeToStream(data: string): Promise<void> {
    if (!this.stream) {
      this.openStream();
    }

    await new Promise<void>((resolve, reject) => {
      const stream = this.stream;
      if (!stream) {
        reject(new Error("Log stream is not available"));
        return;
      }

      const ok = stream.write(data, (err) => {
        if (err) {
          reject(err);
          return;
        }
      });

      if (ok) {
        resolve();
        return;
      }

      stream.once("drain", () => resolve());
      stream.once("error", reject);
    });
  }

  private async rotate(): Promise<void> {
    this.rotateAfterFlush = false;

    if (this.stream) {
      await new Promise<void>((resolve) => {
        const stream = this.stream!;
        stream.end(() => resolve());
      });
      this.stream = null;
    }

    const maxIndex = this.maxFiles - 1;
    const oldestPath = `${this.filePath}.${maxIndex}`;

    if (fs.existsSync(oldestPath)) {
      fs.unlinkSync(oldestPath);
    }

    for (let i = maxIndex - 1; i >= 1; i--) {
      const src = `${this.filePath}.${i}`;
      const dest = `${this.filePath}.${i + 1}`;

      if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
      }
    }

    if (fs.existsSync(this.filePath)) {
      fs.renameSync(this.filePath, `${this.filePath}.1`);
    }

    this.currentSize = 0;
    this.openStream();
  }

  private linesFromMessage(message: ServerMessage): string[] {
    if (message.type === PET_LOADED) {
      return [`[PET LOADED] ${message.data.name} - ${message.data.id}`];
    }
    if (message.type === PET_EVOLVED) {
      return [`[PET EVOLVED] ${message.data.name} - ${message.data.id}`];
    }
    if (message.type === ACHIEVEMENT_UNLOCKED) {
      return message.data.map(achievement => `[ACHIEVEMENT UNLOCKED] ${achievement.name} - ${achievement.id}`);
    }
    if (message.type === EXPERIENCE_ADDED) {
      return [`[EXPERIENCE ADDED] ${message.data}`];
    }

    if (message.type === ACTIVE) {
      return [`[ACTIVE TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === NAVIGATION) {
      return [`[NAVIGATION TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === TERMINAL_COMMAND_EXECUTED) {
      return [`[TERMINAL COMMAND TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === TERMINAL_TESTS_PASSED) {
      return [`[TERMINAL TESTS PASSED TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === DIAGNOSTICS_CHANGED) {
      return [`[DIAGNOSTICS CHANGE TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === GIT_COMMIT) {
      return [`[GIT COMMIT TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === GIT_BRANCH_CREATED) {
      return [`[GIT BRANCH TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === GIT_MERGE) {
      return [`[GIT MERGE TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === FILE_CHANGED) {
      return [`[FILE CHANGE TRACKED] ${message.data.experienceAdded}`];
    }

    if (message.type === FILE_SAVED) {
      return [`[FILE SAVE TRACKED] ${message.data.experienceAdded}`];
    }

    return [];
  }
}