/** The Web surface names the Workspace it serves. */
import { describe, expect, it } from 'vitest'
import { mountSourceLeaf, workspaceLabel, WORKSPACE_LABEL_ENV } from '../src/workspace-label.ts'

// The shape a container's kernel prints for bind-mounted directories.
const MOUNT_INFO = [
  '10974 10964 259:4 /home/naal/dev/llm-chat /workspace rw,relatime - ext4 /dev/nvme0n1p6 rw',
  '10980 10964 259:4 /srv/with\\040space /data rw - ext4 /dev/nvme0n1p6 rw',
  '10990 10964 259:4 /workspace /workspace rw - ext4 /dev/nvme0n1p6 rw',
].join('\n')

describe('mountSourceLeaf', () => {
  it('names the host directory behind a bind-mounted mount point', () => {
    expect(mountSourceLeaf(MOUNT_INFO, '/workspace')).toBe('llm-chat')
  })

  it('unescapes the kernel octal spelling of a directory name', () => {
    expect(mountSourceLeaf(MOUNT_INFO, '/data')).toBe('with space')
  })

  it('reports nothing when the source says no more than the mount point', () => {
    expect(mountSourceLeaf('1 2 259:4 /workspace /workspace rw - ext4 /dev/x rw', '/workspace')).toBeUndefined()
  })

  it('reports nothing for a path that is not a mount point', () => {
    expect(mountSourceLeaf(MOUNT_INFO, '/repo')).toBeUndefined()
    expect(mountSourceLeaf('', '/workspace')).toBeUndefined()
  })
})

describe('workspaceLabel', () => {
  it.each([
    ['/home/naal/dev/llm-chat', 'llm-chat'],
    ['/home/naal/dev/llm-chat/', 'llm-chat'],
    ['/home/naal/dev/DeepSeekHarness/../llm-chat', 'llm-chat'],
    ['C:\\dev\\llm-chat', 'llm-chat'],
    ['llm-chat', 'llm-chat'],
    ['  /home/naal/dev/llm-chat  ', 'llm-chat'],
  ])('takes the last path segment of the configured %j', (value, expected) => {
    expect(workspaceLabel({ [WORKSPACE_LABEL_ENV]: value }, '/nowhere')).toBe(expected)
  })

  it.each([undefined, '', '   ', '/'])('keeps the caller fallback for %j', (value) => {
    const env = value === undefined ? {} : { [WORKSPACE_LABEL_ENV]: value }
    expect(workspaceLabel(env, '/nowhere')).toBeUndefined()
  })
})
