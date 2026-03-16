import type { PackageManifestDependency } from './package-manifest-dependency.js'

export interface PackageDependencyNode {
  readonly packageDir: string
  readonly packageName: string
  readonly dependencies: readonly PackageManifestDependency[]
}
