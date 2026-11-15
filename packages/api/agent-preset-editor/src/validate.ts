/** Shape rules a preset declaration must satisfy before it reaches the patch. */

import type { PresetDeclaration } from './types.ts'

/** One refusal, addressed to the field that caused it. */
export interface PresetValidationIssue {
  /** Dotted path inside the declaration, e.g. `plugins[2].name`. */
  readonly field: string
  /** Human-readable reason. */
  readonly message: string
}

/** Preset identity accepted by the picker, session options and this editor. */
const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/u

/**
 * Check a declaration without touching disk.
 * @param declaration - candidate preset.
 * @param resolvable - whether a plugin package name exists for this profile.
 * @returns every issue found; an empty list means the declaration may be saved.
 */
export function validateDeclaration(
  declaration: PresetDeclaration,
  resolvable: (name: string) => boolean,
): PresetValidationIssue[] {
  const issues: PresetValidationIssue[] = []
  if (!ID_PATTERN.test(declaration.id)) {
    issues.push({ field: 'id', message: 'an id is lowercase letters, digits and dashes, starting with a letter' })
  }
  if (declaration.order !== undefined && !Number.isFinite(declaration.order)) {
    issues.push({ field: 'order', message: 'order must be a finite number' })
  }
  if (declaration.plugins.length === 0) {
    issues.push({ field: 'plugins', message: 'a preset needs at least one plugin row' })
  }
  declaration.plugins.forEach((entry, index) => {
    if (entry === null || typeof entry !== 'object') {
      issues.push({ field: `plugins[${String(index)}]`, message: 'a plugin row must be a mapping' })
      return
    }
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      issues.push({ field: `plugins[${String(index)}].name`, message: 'a plugin row needs a package name' })
      return
    }
    // A preset row naming a package the profile cannot resolve fails to mount,
    // which is how a hand-edited preset silently breaks (0.1.7-era ids).
    if (!resolvable(entry.name)) {
      issues.push({ field: `plugins[${String(index)}].name`, message: `plugin "${entry.name}" is not installed in this profile` })
    }
  })
  return issues
}
