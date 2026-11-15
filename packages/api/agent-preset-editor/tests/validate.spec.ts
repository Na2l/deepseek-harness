import { describe, expect, it } from 'vitest'
import { validateDeclaration } from '../src/validate.ts'

const KNOWN = new Set(['@deepseek-ai/dsh-persona', '@deepseek-ai/dsh-tool-subagent'])
const resolvable = (name: string): boolean => KNOWN.has(name)

const DRAFT = {
  id: 'architect',
  plugins: [
    { id: 'persona', name: '@deepseek-ai/dsh-persona' },
    { id: 'dev', name: '@deepseek-ai/dsh-tool-subagent' },
  ],
}

describe('validateDeclaration', () => {
  it('accepts a resolvable declaration', () => {
    expect(validateDeclaration(DRAFT, resolvable)).toEqual([])
  })

  it.each(['Architect', 'architect v2', '-arch', '', 'a'.repeat(65)])('rejects id %j', (id) => {
    expect(validateDeclaration({ ...DRAFT, id }, resolvable)).toContainEqual(
      expect.objectContaining({ field: 'id' }),
    )
  })

  it('rejects an empty plugin list', () => {
    expect(validateDeclaration({ id: 'x', plugins: [] }, resolvable)).toContainEqual(
      expect.objectContaining({ field: 'plugins' }),
    )
  })

  it('names the plugin row that the profile cannot resolve', () => {
    const issues = validateDeclaration({
      id: 'x',
      plugins: [{ id: 'persona', name: '@deepseek-ai/dsh-persona' }, { id: 'gone', name: '@deepseek-ai/dsh-workflow-worker-thread' }],
    }, resolvable)
    expect(issues).toEqual([{
      field: 'plugins[1].name',
      message: 'plugin "@deepseek-ai/dsh-workflow-worker-thread" is not installed in this profile',
    }])
  })

  it('rejects a row without a name and a non-mapping row', () => {
    const issues = validateDeclaration({
      id: 'x',
      plugins: [{ id: 'persona' }, 'nope'],
    }, resolvable)
    expect(issues.map(issue => issue.field)).toEqual(['plugins[0].name', 'plugins[1]'])
  })

  it('rejects a non-finite order', () => {
    expect(validateDeclaration({ ...DRAFT, order: Number.POSITIVE_INFINITY }, resolvable)).toContainEqual(
      expect.objectContaining({ field: 'order' }),
    )
  })
})
