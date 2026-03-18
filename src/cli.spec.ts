import { describe, expect, it, vi } from 'vitest'

vi.mock('./app/cli.js', () => ({
  main: vi.fn(),
}))

describe('src/cli', () => {
  it('can be imported as the package entrypoint module', async () => {
    const module = await import('./cli.js')

    expect(module).toBeDefined()
  })
})
