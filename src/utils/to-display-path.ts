import path from 'node:path'

export function toDisplayPath(filePath: string, cwd: string): string {
  const relativePath = path.relative(cwd, filePath)
  if (relativePath === '') {
    return '.'
  }

  const normalizedPath = relativePath.split(path.sep).join('/')
  return normalizedPath.startsWith('..') ? filePath : normalizedPath
}
