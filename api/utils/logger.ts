import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logDir: string | null = null;

function getLogDir(): string {
  if (logDir) return logDir;
  const configured = process.env.LOG_PATH || './logs';
  logDir = path.isAbsolute(configured)
    ? configured
    : path.resolve(__dirname, '..', '..', configured);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

function ts(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function writeLog(filename: string, level: string, ...args: unknown[]): void {
  try {
    const dir = getLogDir();
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const fname = `${filename}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.log`;
    const line = `[${ts()}] [${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
    fs.appendFileSync(path.join(dir, fname), line, 'utf-8');
  } catch {
    // ignore
  }
}

export const logger = {
  info: (...args: unknown[]) => {
    console.log('\x1b[36m[INFO]\x1b[0m', ...args);
    writeLog('access', 'INFO', ...args);
  },
  warn: (...args: unknown[]) => {
    console.warn('\x1b[33m[WARN]\x1b[0m', ...args);
    writeLog('error', 'WARN', ...args);
  },
  error: (...args: unknown[]) => {
    console.error('\x1b[31m[ERROR]\x1b[0m', ...args);
    writeLog('error', 'ERROR', ...args);
  },
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('\x1b[90m[DEBUG]\x1b[0m', ...args);
    }
  },
};
