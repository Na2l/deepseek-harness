import { describe, expect, it } from 'vitest'
import { presetRowId, readPresetBlock, removePreset, renderPresetBlock, upsertPreset } from '../src/patch-document.ts'

const DOC = `# profile patch
- id: web
  config:
    fetchProvider: http

# ── an existing preset ─────────────────────────────────────────
- id: preset-architect
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: architect
    order: 2
    plugins:
      - id: persona
        name: '@deepseek-ai/dsh-persona'

- id: settings
  config:
    path: /data/shared/settings.yaml
`

const DRAFT = {
  id: 'reviewer',
  name: 'Reviewer',
  description: 'Reads diffs only',
  order: 3,
  plugins: [{ id: 'persona', name: '@deepseek-ai/dsh-persona', config: { prefix: 'review' } }],
}

describe('presetRowId', () => {
  it('prefixes the identity', () => {
    expect(presetRowId('architect')).toBe('preset-architect')
  })
})

describe('renderPresetBlock', () => {
  it('renders the full declaration under one row', () => {
    const block = renderPresetBlock(DRAFT)
    expect(block.split('\n')[0]).toBe('- id: preset-reviewer')
    expect(block).toContain("  name: '@deepseek-ai/dsh-agent-preset'")
    expect(block).toContain('    id: reviewer')
    expect(block).toContain('    order: 3')
    expect(block).toMatch(/^        name: ["']@deepseek-ai\/dsh-persona["']$/mu)
  })
})

describe('upsertPreset', () => {
  it('appends a new row and leaves the rest byte-identical', () => {
    const next = upsertPreset(DOC, DRAFT)
    expect(next.startsWith(DOC.trimEnd())).toBe(true)
    expect(next).toContain('- id: preset-reviewer')
    expect(readPresetBlock(next, 'reviewer')).toContain('id: reviewer')
  })

  it('replaces an existing row in place', () => {
    const next = upsertPreset(DOC, { ...DRAFT, id: 'architect', name: 'Architect v2' })
    expect(next.match(/- id: preset-architect/gu)).toHaveLength(1)
    expect(next).toContain('name: Architect v2')
    expect(next).toContain('- id: settings')
    expect(next.split('- id: web')).toHaveLength(2)
  })

  it('turns the empty-sequence marker into the first row', () => {
    const next = upsertPreset('# patch\n[]\n', DRAFT)
    expect(next).toContain('- id: preset-reviewer')
    expect(next).not.toContain('[]')
    expect(next.startsWith('# patch\n')).toBe(true)
  })

  it('preserves js expressions and comments elsewhere', () => {
    const text = '- id: noop\n  config:\n    when: !!js process.platform === "win32"\n# keep me\n'
    const next = upsertPreset(text, DRAFT)
    expect(next).toContain('when: !!js process.platform === "win32"')
    expect(next).toContain('# keep me')
  })
})

describe('removePreset', () => {
  it('removes only the targeted row', () => {
    const next = removePreset(DOC, 'architect')
    expect(next).not.toContain('preset-architect')
    expect(next).toContain('- id: web')
    expect(next).toContain('- id: settings')
  })

  it('is a no-op for an unknown id', () => {
    expect(removePreset(DOC, 'nope')).toBe(DOC)
  })
})
