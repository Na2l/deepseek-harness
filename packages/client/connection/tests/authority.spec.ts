/** Shared authority normalization and trust matching for the fence and browser UI. */

import { describe, expect, it } from 'vitest'
import { isTrustedAuthority, isTrustedPageAuthority, parseAuthority } from '../src/authority.ts'

describe('isTrustedPageAuthority', () => {
  it('accepts loopback hosts regardless of trusted entries', () => {
    expect(isTrustedPageAuthority('localhost', '', [])).toBe(true)
    expect(isTrustedPageAuthority('127.0.0.1', '8081', [])).toBe(true)
  })

  it('accepts a port-less trusted entry on any port', () => {
    expect(isTrustedPageAuthority('harness.internal', '8081', ['harness.internal'])).toBe(true)
    expect(isTrustedPageAuthority('harness.internal', '', ['harness.internal'])).toBe(true)
  })

  it('accepts an exact host:port trusted entry', () => {
    expect(isTrustedPageAuthority('harness.internal', '8081', ['harness.internal:8081'])).toBe(true)
  })

  it('refuses a non-loopback host absent from trusted entries', () => {
    expect(isTrustedPageAuthority('evil.example', '8081', ['harness.internal'])).toBe(false)
  })

  it('refuses a host:port trusted entry on a different port', () => {
    expect(isTrustedPageAuthority('harness.internal', '9090', ['harness.internal:8081'])).toBe(false)
  })
})

describe('isTrustedAuthority', () => {
  it('matches a port-less entry against any port', () => {
    const host = parseAuthority('harness.internal:9999')
    expect(host).toBeDefined()
    expect(isTrustedAuthority(host!, ['harness.internal'])).toBe(true)
  })

  it('matches a host:port entry exactly', () => {
    const host = parseAuthority('harness.internal:8081')
    expect(isTrustedAuthority(host!, ['harness.internal:8081'])).toBe(true)
    expect(isTrustedAuthority(host!, ['harness.internal:9090'])).toBe(false)
  })
})
