import { version } from '../index'

describe('@hanzo/insights-mcp scaffold', () => {
  it('exports a semver-shaped version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
