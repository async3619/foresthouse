import path from 'node:path'

export function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath)
}
