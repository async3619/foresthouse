export interface ExternalPackageManifestDependency {
  readonly kind: 'external'
  readonly name: string
  readonly specifier: string
}

export interface WorkspacePackageManifestDependency {
  readonly kind: 'workspace'
  readonly name: string
  readonly specifier?: string
  readonly target: string
}

export type PackageManifestDependency =
  | ExternalPackageManifestDependency
  | WorkspacePackageManifestDependency
