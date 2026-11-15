/**
 * Host half of the preset editor: validates a declaration and writes it as a
 * `- id: preset-<name>` row of the active profile patch, so the existing preset
 * registry picks it up through the patch watcher. No UI knowledge lives here.
 */

import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-config-editor'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { presetRowId, removePreset, upsertPreset } from './patch-document.ts'
import type { PresetDeclaration, PresetEditorOptions, PresetSaveResult } from './types.ts'
import { validateDeclaration } from './validate.ts'

export type { PresetDeclaration, PresetEditorOptions, PresetSaveResult } from './types.ts'
export type { PresetValidationIssue } from './validate.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The declaration did not pass validation; `issues` names every field. */
    'agent-preset-editor/invalid': { readonly issues: readonly string[] }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `agentPresetEditor` Remote namespace. */
    agentPresetEditor: AgentPresetEditor
  }
}

/**
 * Write-side counterpart of the read-only preset registry: the registry lists
 * and reads declarations, this service authors them.
 */
export class AgentPresetEditor extends TypertRemoteService {
  static inject = ['configEditor']

  /** @param ctx - Host context carrying the config editor and (optionally) the model catalog. */
  constructor(ctx: Context) {
    super(ctx, 'agentPresetEditor', { namespace: 'agentPresetEditor' })
  }

  /**
   * Provider routes and their models, for the inspector's dropdowns.
   * @returns one entry per registered provider route; empty when no catalog is mounted.
   */
  @Remote('options')
  async options(): Promise<PresetEditorOptions> {
    const llm = this.ctx.get('llm')
    if (llm === undefined) return { providers: [] }
    const providers = await Promise.all(llm.listProviders().map(async provider => ({
      id: provider.id,
      models: (await llm.listModels(provider.id)).map(model => model.id),
    })))
    return { providers }
  }

  /**
   * Validate a declaration against this profile, then write it as one patch row.
   * @param declaration - preset to create or replace.
   * @returns the identity and the row that carries it.
   * @throws RemoteError `agent-preset-editor/invalid` listing every issue.
   */
  @Remote('save')
  async save(declaration: PresetDeclaration): Promise<PresetSaveResult> {
    const issues = validateDeclaration(declaration, this.resolvable())
    if (issues.length > 0) {
      throw new RemoteError('agent-preset-editor/invalid', 'preset declaration rejected',
        { issues: issues.map(issue => `${issue.field}: ${issue.message}`) })
    }
    await this.edit(text => upsertPreset(text, declaration))
    return { id: declaration.id, rowId: presetRowId(declaration.id) }
  }

  /**
   * Remove one preset row.
   * @param id - preset identity.
   * @returns whether a row was removed.
   */
  @Remote('remove')
  async remove(id: string): Promise<{ removed: boolean }> {
    let removed = false
    await this.edit((text) => {
      const next = removePreset(text, id)
      removed = next !== text
      return next
    })
    return { removed }
  }

  /** Resolver for the active profile's installed plugin packages. */
  private resolvable(): (name: string) => boolean {
    const profileDir = this.ctx.get('profileContext')?.dir
    if (profileDir === undefined) return () => true
    const requireFromProfile = createRequire(join(profileDir, 'package.json'))
    return (name) => {
      try {
        requireFromProfile.resolve(`${name}/package.json`)
        return true
      } catch {
        return false
      }
    }
  }

  /** Read-modify-write the profile patch under the document lock. */
  private async edit(mutate: (text: string) => string): Promise<void> {
    const path = this.ctx.configEditor.documentPath
    await withFileLock(path, async () => {
      const before = await readFile(path, 'utf8').catch(() => '# profile patch\n[]\n')
      const next = mutate(before)
      if (next !== before) await writeFileAtomic(path, next, { mode: 0o600, dirMode: 0o700 })
    }, { waitMs: 5000 })
  }
}

export default AgentPresetEditor
