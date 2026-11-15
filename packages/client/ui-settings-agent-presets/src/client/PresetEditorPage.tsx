/**
 * Agent-preset authoring: pick a preset, read its agent hierarchy, and edit a
 * child agent's provider/model in place. Saving goes through the host's
 * validation, which refuses rows this profile cannot resolve.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { parse } from 'yaml'

/** One row of a preset declaration. */
interface PluginRow {
  readonly id?: unknown
  readonly name?: unknown
  readonly config?: Record<string, unknown>
}

/** Preset entry as the registry lists it. */
interface PresetRow {
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly order?: number
  readonly broken?: string
}

/** Provider dropdown entry. */
interface ProviderOption {
  readonly id: string
  readonly models: readonly string[]
}

/** Remote calls the section owner hands to the page. */
export interface EditorApi {
  readonly list: () => Promise<readonly PresetRow[]>
  readonly read: (id: string) => Promise<{ content?: string }>
  readonly options: () => Promise<readonly ProviderOption[]>
  readonly save: (declaration: {
    readonly id: string
    readonly name?: string
    readonly description?: string
    readonly order?: number
    readonly plugins: readonly PluginRow[]
  }) => Promise<void>
}

interface Props {
  /** Closes the settings panel. */
  readonly close?: () => void
  /** Remote calls injected by this package's registration. */
  readonly api: EditorApi
}

/** Read one child agent identity out of a tool-subagent row. */
function childAgent(row: PluginRow): { toolName: string; provider?: string; model?: string } | undefined {
  if (typeof row.name !== 'string' || !row.name.endsWith('/dsh-tool-subagent')) return undefined
  const config = row.config ?? {}
  const toolName = typeof config['toolName'] === 'string' ? config['toolName'] : '(unnamed)'
  const options = (config['agentOptions'] ?? {}) as Record<string, unknown>
  return {
    toolName,
    ...typeof options['provider'] === 'string' ? { provider: options['provider'] } : {},
    ...typeof options['model'] === 'string' ? { model: options['model'] } : {},
  }
}

/**
 * Render the Agent presets settings page.
 * @param props - the settings section closes itself through `close`.
 * @returns the page element tree.
 */
export function PresetEditorPage({ close, api }: Props): ReactElement {
  const [presets, setPresets] = useState<readonly PresetRow[]>([])
  const [selected, setSelected] = useState<PresetRow | undefined>(undefined)
  const [rows, setRows] = useState<PluginRow[]>([])
  const [providers, setProviders] = useState<readonly ProviderOption[]>([])
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      const list = await api.list()
      setPresets(list)
      setSelected(list[0])
      setProviders(await api.options())
    })().catch((reason: unknown) => { setError(String(reason)) })
  }, [api])

  useEffect(() => {
    if (selected === undefined) return
    void (async () => {
      const document = await api.read(selected.id)
      setRows(parse(document.content ?? '[]') as PluginRow[])
      setActiveIndex(undefined)
    })().catch((reason: unknown) => { setError(String(reason)) })
  }, [api, selected])

  const children = useMemo(() => rows
    .map((row, index) => ({ row, index, agent: childAgent(row) }))
    .filter(entry => entry.agent !== undefined), [rows])

  const save = useCallback(() => {
    if (selected === undefined) return
    void (async () => {
      setError(undefined)
      try {
        await api.save({
          id: selected.id,
          ...selected.name === undefined ? {} : { name: selected.name },
          ...selected.description === undefined ? {} : { description: selected.description },
          ...selected.order === undefined ? {} : { order: selected.order },
          plugins: rows,
        })
        setSaved(true)
      } catch (reason) {
        const issues = (reason as { details?: { issues?: string[] } }).details?.issues
        setError(issues === undefined ? String(reason) : issues.join('\n'))
      }
    })()
  }, [api, rows, selected])

  const assign = useCallback((index: number, provider: string, model: string) => {
    setRows(current => current.map((row, position) => {
      if (position !== index) return row
      const config = { ...row.config ?? {} }
      config['agentOptions'] = { ...(config['agentOptions'] as Record<string, unknown> ?? {}), provider, model }
      return { ...row, config }
    }))
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 16 }}>
      <nav>
        <strong>Presets</strong>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {presets.map(preset => (
            <li key={preset.id}>
              <button type="button" onClick={() => { setSelected(preset) }} aria-pressed={preset.id === selected?.id}
                style={{ width: '100%', textAlign: 'left', fontWeight: preset.id === selected?.id ? 600 : 400 }}>
                {preset.name ?? preset.id}{preset.broken === undefined ? '' : ' ⚠'}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={close}>Close</button>
      </nav>

      <section>
        <h3>{selected?.name ?? selected?.id ?? 'No preset'}</h3>
        {selected?.broken === undefined ? null : <p role="alert">broken: {selected.broken}</p>}
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {children.map(({ row, index, agent }) => (
            <li key={String(row.id ?? index)}>
              <button type="button" onClick={() => { setActiveIndex(index) }} aria-pressed={index === activeIndex}>
                ↳ <strong>{agent?.toolName}</strong>
                {agent?.provider === undefined ? '' : ` · ${agent.provider}/${agent.model ?? ''}`}
              </button>
            </li>
          ))}
        </ul>
        <p style={{ opacity: 0.7 }}>{rows.length - children.length} other plugin rows</p>
        <button type="button" onClick={save} disabled={selected === undefined}>Save preset</button>
        {saved === false ? null : <span> saved</span>}
        {error === undefined ? null : <pre role="alert" style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>}
      </section>

      <aside>
        <strong>Inspector</strong>
        {activeIndex === undefined
          ? <p style={{ opacity: 0.7 }}>Select an agent</p>
          : (() => {
            const agent = childAgent(rows[activeIndex] ?? {})
            if (agent === undefined) return <p style={{ opacity: 0.7 }}>Not an agent row</p>
            const provider = providers.find(option => option.id === agent.provider)
            return (
              <div>
                <p>{agent.toolName}</p>
                <label>Provider
                  <select value={agent.provider ?? ''} onChange={(event) => {
                    const next = providers.find(option => option.id === event.target.value)
                    assign(activeIndex, event.target.value, next?.models[0] ?? '')
                  }}>
                    <option value="">—</option>
                    {providers.map(option => <option key={option.id} value={option.id}>{option.id}</option>)}
                  </select>
                </label>
                <label>Model
                  <select value={agent.model ?? ''} onChange={(event) => {
                    assign(activeIndex, agent.provider ?? '', event.target.value)
                  }}>
                    {(provider?.models ?? []).map(model => <option key={model} value={model}>{model}</option>)}
                  </select>
                </label>
              </div>
            )
          })()}
      </aside>
    </div>
  )
}
