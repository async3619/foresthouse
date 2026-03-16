import fs from 'node:fs'
import path from 'node:path'

import { isSourceCodeFile } from '../../utils/is-source-code-file.js'
import { normalizeFilePath } from '../../utils/normalize-file-path.js'

export function resolveExistingPath(cwd: string, entryFile: string): string {
  const absolutePath = path.resolve(cwd, entryFile)
  const normalizedPath = normalizeFilePath(absolutePath)

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Entry file not found: ${entryFile}`)
  }

  if (!isSourceCodeFile(normalizedPath)) {
    throw new Error(`Entry file must be a JS/TS source file: ${entryFile}`)
  }

  return normalizedPath
}
