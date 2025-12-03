import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads');

export function ensureUploadsDir(mode = 0o755) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true, mode });
  }
}

/**
 * Returns true if filePath is inside base (prevent path traversal).
 */
export function isPathUnderBase(filePath: string, base = UPLOADS_DIR) {
  const absoluteFilePath = path.resolve(filePath);
  const absoluteBase = path.resolve(base);
  const relative = path.relative(absoluteBase, absoluteFilePath);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Resolve file within the uploads directory, throw if outside base.
 */
export function resolvePathInUploads(relativeOrAbsolute: string) {
  const candidate = path.resolve(relativeOrAbsolute);
  // If given a path that's already absolute but outside uploads, handle
  if (!isPathUnderBase(candidate)) {
    throw new Error('File path resolves outside of uploads directory');
  }
  return candidate;
}

/**
 * Safe unlink: ignores ENOENT (file not found) and otherwise rethrows.
 */
export async function safeUnlink(filePath: string) {
  try {
    await fsPromises.unlink(filePath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
}