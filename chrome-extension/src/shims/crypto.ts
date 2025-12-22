// Browser-compatible crypto shim
// Uses a simple hash for generating IDs (not for cryptographic security)
// The Web Crypto API (crypto.subtle.digest) is async, but the OWID code
// uses createHash synchronously, so we use a fast non-crypto hash instead.

/**
 * cyrb53 - a fast, high-quality 53-bit hash function
 * https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 */
function cyrb53(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed
    let h2 = 0x41c6ce57 ^ seed
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i)
        h1 = Math.imul(h1 ^ ch, 2654435761)
        h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    // Return as 16-char hex string (similar length to truncated SHA-1)
    const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0)
    return hash.toString(16).padStart(16, "0")
}

class BrowserHash {
    private data: string = ""

    update(data: string): this {
        this.data += data
        return this
    }

    digest(_encoding: "hex"): string {
        // Generate multiple hashes with different seeds for longer output
        const h1 = cyrb53(this.data, 0)
        const h2 = cyrb53(this.data, 1)
        return h1 + h2 + h1.slice(0, 8) // 40 chars like SHA-1
    }
}

export function createHash(_algorithm: string) {
    return new BrowserHash()
}
