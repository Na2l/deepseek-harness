/**
 * Minimal, text-preserving edits to the preset rows of a profile patch.
 *
 * A patch file also carries hand-written comments and `!!js` expressions, so
 * these helpers never re-serialize the document: they locate one top-level
 * `- id: preset-<name>` block by its column-0 boundaries and replace, append or
 * remove exactly that block.
 */

import { stringify } from 'yaml'

/** One agent-preset declaration, as the profile patch spells it. */
export interface PresetDeclaration {
  /** Preset identity used by sessions and the picker. */
  readonly id: string
  /** Display name; defaults to the id in the picker. */
  readonly name?: string
  /** One-line description shown by the picker. */
  readonly description?: string
  /** Ascending picker order. */
  readonly order?: number
  /** Child plugin rows: persona, tools, subagents, skills, … */
  readonly plugins: readonly unknown[]
}

/** Plugin package that carries a preset declaration. */
export const PRESET_PLUGIN = '@deepseek-ai/dsh-agent-preset'

/** Profile-patch row id for a preset identity. */
export function presetRowId(id: string): string {
  return `preset-${id}`
}

/** Whether a line starts a top-level patch entry. */
function startsEntry(line: string): boolean {
  return /^- (?:id|insert):/u.test(line)
}

/**
 * Render one declaration as a patch entry.
 * @param declaration - preset to render.
 * @returns the YAML block, without a trailing newline.
 */
export function renderPresetBlock(declaration: PresetDeclaration): string {
  const config = {
    id: declaration.id,
    ...declaration.name === undefined ? {} : { name: declaration.name },
    ...declaration.description === undefined ? {} : { description: declaration.description },
    ...declaration.order === undefined ? {} : { order: declaration.order },
    plugins: declaration.plugins,
  }
  const body = stringify(config, { lineWidth: 0 }).trimEnd()
  const indented = body.split('\n').map(line => `    ${line}`).join('\n')
  return `- id: ${presetRowId(declaration.id)}\n  name: '${PRESET_PLUGIN}'\n  config:\n${indented}`
}

/**
 * Locate one top-level entry's line range.
 * @param lines - document lines.
 * @param rowId - entry id to find.
 * @returns inclusive start and exclusive end indexes, or undefined.
 */
function locate(lines: readonly string[], rowId: string): { start: number; end: number } | undefined {
  const start = lines.findIndex(line => line === `- id: ${rowId}`)
  if (start < 0) return undefined
  let end = start + 1
  while (end < lines.length && !startsEntry(lines[end] ?? '')) end++
  // Trailing blank lines and the standalone `# ==` separators belong to nobody:
  // keep them with the surrounding document instead of the replaced block.
  while (end > start + 1 && (lines[end - 1] ?? '').trim() === '') end--
  return { start, end }
}

/**
 * Insert or replace one preset row, leaving every other byte untouched.
 * @param text - current patch document.
 * @param declaration - preset to write.
 * @returns the updated document text.
 */
export function upsertPreset(text: string, declaration: PresetDeclaration): string {
  const lines = text.split('\n')
  const block = renderPresetBlock(declaration)
  const found = locate(lines, presetRowId(declaration.id))
  if (found !== undefined) {
    lines.splice(found.start, found.end - found.start, ...block.split('\n'))
    return lines.join('\n')
  }
  // An untouched patch file carries the empty-sequence marker; replace it.
  const marker = lines.findIndex(line => line.trim() === '[]')
  if (marker >= 0) {
    lines.splice(marker, 1, ...block.split('\n'))
    return lines.join('\n')
  }
  const tail = text.endsWith('\n') ? '' : '\n'
  return `${text}${tail}\n${block}\n`
}

/**
 * Remove one preset row, leaving every other byte untouched.
 * @param text - current patch document.
 * @param id - preset identity.
 * @returns the updated document text, or the input when the row is absent.
 */
export function removePreset(text: string, id: string): string {
  const lines = text.split('\n')
  const found = locate(lines, presetRowId(id))
  if (found === undefined) return text
  lines.splice(found.start, found.end - found.start)
  return lines.join('\n')
}

/**
 * Read the child rows of one preset from a patch document, for the editor's
 * hierarchy view.
 * @param text - patch document.
 * @param id - preset identity.
 * @returns the block text, or undefined when the profile patch does not own it.
 */
export function readPresetBlock(text: string, id: string): string | undefined {
  const lines = text.split('\n')
  const found = locate(lines, presetRowId(id))
  if (found === undefined) return undefined
  return lines.slice(found.start, found.end).join('\n')
}
