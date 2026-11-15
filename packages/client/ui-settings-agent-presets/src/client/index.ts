/** Registers the Agent presets settings page. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-agent-preset-editor/remote'
import { PresetEditorPage, type EditorApi } from './PresetEditorPage.tsx'

/** Remote namespaces the page reads and writes. */
export const inject = ['slots', 'remote', 'remote.agentPresets', 'remote.agentPresetEditor']

/**
 * Mount the page as one settings section, handing it the remote calls it needs.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  const api: EditorApi = {
    list: async () => ((await ctx.remote.agentPresets.list()) as { presets?: never }).presets ?? [],
    read: async id => (await ctx.remote.agentPresets.read(id)) as { content?: string },
    options: async () => ((await ctx.remote.agentPresetEditor.options()) as { providers?: never }).providers ?? [],
    save: async (declaration) => {
      await ctx.remote.agentPresetEditor.save(declaration as never)
    },
  }
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'agent-presets',
    order: 20,
    label: () => 'Agent presets',
    inject: () => ({ api }),
  }, PresetEditorPage))
}
