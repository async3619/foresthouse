import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { analyzePackageDependencies } from './index.js'

describe('analyzePackageDependencies', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deps-')))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('analyzes a single package with no dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app' }),
    )

    const graph = analyzePackageDependencies(tmpDir)

    expect(graph.rootId).toBe(tmpDir)
    expect(graph.nodes.size).toBe(1)
    const rootNode = graph.nodes.get(tmpDir)
    expect(rootNode).toBeDefined()
    expect(rootNode?.packageName).toBe('test-app')
    expect(rootNode?.dependencies).toEqual([])
  })

  it('analyzes a package with external dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        dependencies: { react: '^18.0.0', lodash: '^4.0.0' },
      }),
    )

    const graph = analyzePackageDependencies(tmpDir)
    const rootNode = graph.nodes.get(tmpDir)

    expect(rootNode?.dependencies.length).toBe(2)
    const reactDep = rootNode?.dependencies.find((d) => d.name === 'react')
    expect(reactDep?.kind).toBe('external')
  })

  it('throws on non-existent directory', () => {
    expect(() =>
      analyzePackageDependencies(path.join(tmpDir, 'nope')),
    ).toThrow()
  })

  it('throws when no package.json found', () => {
    const emptyDir = path.join(tmpDir, 'empty')
    fs.mkdirSync(emptyDir)

    expect(() => analyzePackageDependencies(emptyDir)).toThrow(
      'No package.json found',
    )
  })

  it('throws when package.json has no name', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: {} }),
    )

    expect(() => analyzePackageDependencies(tmpDir)).toThrow(
      'missing a valid name',
    )
  })

  it('discovers npm workspace packages', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    )
    const libDir = path.join(tmpDir, 'packages', 'lib-a')
    fs.mkdirSync(libDir, { recursive: true })
    fs.writeFileSync(
      path.join(libDir, 'package.json'),
      JSON.stringify({ name: '@my/lib-a' }),
    )

    const graph = analyzePackageDependencies(tmpDir)

    expect(graph.nodes.size).toBe(2)
    expect(graph.nodes.has(tmpDir)).toBe(true)
    expect(graph.nodes.has(libDir)).toBe(true)
  })

  it('discovers pnpm workspace packages', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root' }),
    )
    fs.writeFileSync(
      path.join(tmpDir, 'pnpm-workspace.yaml'),
      'packages:\n  - "packages/*"\n',
    )
    const libDir = path.join(tmpDir, 'packages', 'lib-a')
    fs.mkdirSync(libDir, { recursive: true })
    fs.writeFileSync(
      path.join(libDir, 'package.json'),
      JSON.stringify({ name: '@my/lib-a' }),
    )

    const graph = analyzePackageDependencies(tmpDir)
    expect(graph.nodes.size).toBe(2)
  })

  it('resolves workspace dependencies between sibling packages', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    )
    const libA = path.join(tmpDir, 'packages', 'lib-a')
    const libB = path.join(tmpDir, 'packages', 'lib-b')
    fs.mkdirSync(libA, { recursive: true })
    fs.mkdirSync(libB, { recursive: true })
    fs.writeFileSync(
      path.join(libA, 'package.json'),
      JSON.stringify({ name: 'lib-a', dependencies: { 'lib-b': '*' } }),
    )
    fs.writeFileSync(
      path.join(libB, 'package.json'),
      JSON.stringify({ name: 'lib-b' }),
    )

    const graph = analyzePackageDependencies(libA)

    const libANode = graph.nodes.get(libA)
    expect(libANode).toBeDefined()
    const wsDep = libANode?.dependencies.find((d) => d.kind === 'workspace')
    expect(wsDep).toBeDefined()
    expect(wsDep?.name).toBe('lib-b')
  })

  it('accepts a package.json file path directly', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app' }),
    )

    const graph = analyzePackageDependencies(path.join(tmpDir, 'package.json'))
    expect(graph.nodes.size).toBe(1)
  })

  it('handles circular workspace dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] }),
    )
    const libA = path.join(tmpDir, 'packages', 'a')
    const libB = path.join(tmpDir, 'packages', 'b')
    fs.mkdirSync(libA, { recursive: true })
    fs.mkdirSync(libB, { recursive: true })
    fs.writeFileSync(
      path.join(libA, 'package.json'),
      JSON.stringify({ name: 'a', dependencies: { b: '*' } }),
    )
    fs.writeFileSync(
      path.join(libB, 'package.json'),
      JSON.stringify({ name: 'b', dependencies: { a: '*' } }),
    )

    const graph = analyzePackageDependencies(libA)
    expect(graph.nodes.size).toBeGreaterThanOrEqual(2)
  })
})
