import path from 'node:path'

export const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
])

export function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath)
}

export function toDisplayPath(filePath: string, cwd: string): string {
  const relativePath = path.relative(cwd, filePath)
  if (relativePath === '') {
    return '.'
  }

  const normalizedPath = relativePath.split(path.sep).join('/')
  return normalizedPath.startsWith('..') ? filePath : normalizedPath
}

export function isSourceCodeFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}
