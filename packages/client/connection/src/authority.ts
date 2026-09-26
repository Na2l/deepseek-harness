/**
 * Browser-safe authority normalization and trust matching shared by the Host
 * `/api` fence and the Client privileged-surface classification.
 */

import { isLoopbackHostname } from './loopback-hostname.ts'

/** Normalized URL of a Host-header authority (hostname lowercased, default port stripped, IPv6 bracketed), or undefined when unparsable. */
export function parseAuthority(authority: string): URL | undefined {
  try {
    // http: is a WHATWG "special scheme": parsing yields a non-empty hostname or throws.
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/**
 * Canonical form of a parsed authority: `hostname` when no port was written,
 * else `hostname:port`. The port is judged from URL parses under both special
 * schemes (their default ports differ, so `:80` and `:443` still count as
 * explicit), never from the raw string, where WHATWG trimming would misread
 * shapes like `host:port ` as port-less.
 */
export function canonicalAuthority(entry: string, entryUrl: URL): string {
  // An authority that parsed under http cannot fail under https.
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

/**
 * Whether the request authority matches a `trustedHosts` entry. An entry with
 * an explicit port matches that exact authority; a port-less entry matches the
 * hostname on any port (the shape the CLI derives for IP-literal LAN serving,
 * where the bound port may be OS-assigned). Both sides compare through WHATWG
 * normalization, so case and a redundant `:80` never decide trust.
 */
export function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/**
 * Whether a page authority (hostname plus optional port) is a trusted Host:
 * loopback, or a declared `trustedHosts` entry. A port-less trusted entry
 * matches the hostname on any port; a `host:port` entry matches exactly.
 * @param hostname - page URL hostname.
 * @param port - page URL port, or '' for the scheme default.
 * @param trustedHosts - deployment authorities accepted by the Host/Origin fence.
 * @returns true when the page authority is loopback or a trusted entry.
 */
export function isTrustedPageAuthority(hostname: string, port: string, trustedHosts: readonly string[]): boolean {
  if (isLoopbackHostname(hostname)) return true
  const authority = port === '' ? hostname : `${hostname}:${port}`
  const hostUrl = parseAuthority(authority)
  return hostUrl !== undefined && isTrustedAuthority(hostUrl, trustedHosts)
}
