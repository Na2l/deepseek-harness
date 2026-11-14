/**
 * Name of the Workspace this Web surface serves, for the page title and the
 * sidebar brand.
 *
 * Inside a container the Workspace is a bind mount of a host directory at an
 * arbitrary point (`/workspace` in the shipped image), so the registered
 * path's last segment names the mount point rather than the project. The mount
 * table still records which host directory backs it, which is the honest answer.
 */

import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Environment variable naming the Workspace explicitly; overrides discovery.
 * A path or a bare name is accepted and its last segment becomes the label.
 */
export const WORKSPACE_LABEL_ENV = 'DSH_WORKSPACE_LABEL'

/** Page global carrying the resolved name. */
export const WORKSPACE_LABEL_GLOBAL = '__DSH_WORKSPACE_LABEL__'

/** Mount table consulted for the host path behind a bind-mounted Workspace. */
const MOUNT_INFO_PATH = '/proc/self/mountinfo'

/** Last path segment of a POSIX path, or undefined when it has none. */
function posixLeaf(path: string): string | undefined {
  return path.split('/').filter(segment => segment.length > 0).at(-1)
}

/** Undo mountinfo's octal escaping of spaces, tabs, newlines, and backslashes. */
function unescapeMountPath(value: string): string {
  return value.replace(/\\([0-7]{3})/gu, (_match, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)))
}

/**
 * Host directory name behind one mount point, read from a Linux mount table.
 * @param mountInfo - contents of `/proc/self/mountinfo`.
 * @param mountPoint - absolute directory to look up.
 * @returns the host directory's leaf name, or undefined when the path is not a
 * mount point or its source says no more than the mount point itself.
 */
export function mountSourceLeaf(mountInfo: string, mountPoint: string): string | undefined {
  for (const line of mountInfo.split('\n')) {
    if (line === '') continue
    // id parent major:minor root mountpoint options [optional fields] - fstype source superopts
    const fields = line.split(' ')
    if (fields[4] !== mountPoint) continue
    const leaf = posixLeaf(unescapeMountPath(fields[3] ?? ''))
    if (leaf === undefined || leaf === posixLeaf(mountPoint)) return undefined
    return leaf
  }
  return undefined
}

/**
 * Resolve the Workspace name to advertise.
 *
 * Order: the explicit {@link WORKSPACE_LABEL_ENV} override, then the host
 * directory discovered through the bind mount of the served directory. Without
 * either, the page keeps its registered-path fallback.
 * @param env - process environment.
 * @param directory - directory served as the Workspace.
 * @returns the label, or undefined when no name can be established.
 */
export function workspaceLabel(
  env: Readonly<Record<string, string | undefined>>,
  directory: string,
): string | undefined {
  const configured = env[WORKSPACE_LABEL_ENV]
  if (configured !== undefined) {
    const leaf = configured.trim().split(/[\\/]+/u).filter(segment => segment.length > 0).at(-1)
    if (leaf !== undefined) return leaf
  }
  if (process.platform !== 'linux') return undefined
  let served: string
  try {
    served = realpathSync(directory)
  } catch {
    served = resolve(directory)
  }
  try {
    return mountSourceLeaf(readFileSync(MOUNT_INFO_PATH, 'utf8'), served)
  } catch {
    return undefined
  }
}
