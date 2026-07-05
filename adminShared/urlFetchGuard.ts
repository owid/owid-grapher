// SSRF guard for the assistant's URL fetching — shared by the browser-side
// tools and the admin server's fetch proxy (which is why it lives in
// adminShared).

// ---------------------------------------------------------------------------
// SSRF guard — shared by the host implementations and the read_url tool.
// Not a perfect defense (decimal-encoded IPs, DNS rebinding, etc. are out of
// scope), but it blocks the obvious private/metadata targets. The broader
// control is that the user runs the extension on their own machine.
// ---------------------------------------------------------------------------

const parseUrl = (raw: string): { scheme: string; host: string } | null => {
    const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)/i.exec(raw.trim())
    if (!m || m[1] === undefined || m[2] === undefined) return null
    let authority = m[2]
    const at = authority.lastIndexOf("@")
    if (at >= 0) authority = authority.slice(at + 1)
    let host = authority
    if (host.startsWith("[")) {
        const end = host.indexOf("]")
        host = end >= 0 ? host.slice(1, end) : host.slice(1)
    } else {
        const colon = host.indexOf(":")
        if (colon >= 0) host = host.slice(0, colon)
    }
    return { scheme: m[1].toLowerCase(), host: host.toLowerCase() }
}

const ipv4Octets = (host: string): number[] | null => {
    const parts = host.split(".")
    if (parts.length !== 4) return null
    const octets: number[] = []
    for (const p of parts) {
        if (!/^\d{1,3}$/.test(p)) return null
        const n = Number(p)
        if (n > 255) return null
        octets.push(n)
    }
    return octets
}

const isPrivateHost = (host: string): boolean => {
    if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal")
    )
        return true

    // IPv6 loopback / unique-local (fc00::/7) / link-local (fe80::/10).
    if (host === "::1" || host === "::") return true
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return true
    if (/^fe[89ab][0-9a-f]:/.test(host)) return true

    const octets = ipv4Octets(host)
    if (octets) {
        const [a, b] = octets as [number, number, number, number]
        if (a === 0 || a === 127) return true // this-host / loopback
        if (a === 10) return true // 10/8
        if (a === 192 && b === 168) return true // 192.168/16
        if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
        if (a === 169 && b === 254) return true // link-local incl. cloud metadata
        if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
    }
    return false
}

/**
 * Returns a human-readable reason the URL must not be fetched, or null when it
 * is allowed. Used both by host `fetch` implementations and the read_url tool.
 */
export const blockedFetchReason = (raw: string): string | null => {
    const parsed = parseUrl(raw)
    if (!parsed)
        return "That is not a valid absolute URL — it must start with http:// or https://."
    if (parsed.scheme !== "http" && parsed.scheme !== "https")
        return `Refusing to fetch a ${parsed.scheme}: URL — only http and https are allowed.`
    if (isPrivateHost(parsed.host))
        return `Refusing to fetch ${parsed.host} — it resolves to a private, loopback, or link-local address.`
    return null
}
