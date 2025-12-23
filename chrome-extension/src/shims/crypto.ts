import { sha1 } from "@noble/hashes/legacy.js"
import { bytesToHex } from "@noble/hashes/utils.js"

class BrowserHash {
    private chunks: Uint8Array[] = []

    update(data: string | Uint8Array): this {
        const chunk =
            typeof data === "string" ? new TextEncoder().encode(data) : data
        this.chunks.push(chunk)
        return this
    }

    digest(encoding: "hex"): string {
        if (encoding !== "hex") {
            throw new Error(`Unsupported encoding: ${encoding}`)
        }

        const totalLength = this.chunks.reduce(
            (sum, chunk) => sum + chunk.length,
            0
        )
        const merged = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of this.chunks) {
            merged.set(chunk, offset)
            offset += chunk.length
        }

        return bytesToHex(sha1(merged))
    }
}

export function createHash(algorithm: string): BrowserHash {
    if (algorithm !== "sha1") {
        throw new Error(`Unsupported hash algorithm: ${algorithm}`)
    }

    return new BrowserHash()
}
