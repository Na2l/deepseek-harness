/** Wire types shared by the preset editor's host half and its browser caller. */

/** JSON-safe value a plugin row's config may carry across the wire. */
export type PresetJson =
  | string
  | number
  | boolean
  | null
  | readonly PresetJson[]
  | { readonly [key: string]: PresetJson }

/** One plugin row inside a preset declaration. */
export interface PresetPluginRow {
  /** Row identity inside the preset. */
  readonly id?: string
  /** Plugin package name. */
  readonly name?: string
  /** Plugin configuration, as the Loader receives it. */
  readonly config?: { readonly [key: string]: PresetJson }
}

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
  readonly plugins: readonly PresetPluginRow[]
}

/** Dropdown sources for the editor's inspector. */
export interface PresetEditorOptions {
  /** Provider routes with the models each one serves. */
  readonly providers: ReadonlyArray<{ readonly id: string; readonly models: readonly string[] }>
}

/** Result of a successful save. */
export interface PresetSaveResult {
  /** Preset identity written into the declaration. */
  readonly id: string
  /** Profile-patch row that now carries it. */
  readonly rowId: string
}
