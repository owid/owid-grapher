/**
 * Synchronous pure-JS SHA-1, replacing node:crypto's createHash("sha1") so
 * this package stays free of node builtins (it must run in browsers too).
 * Used only to derive stable ids for unkeyed refs; produces the same hex
 * digests as node:crypto.
 */
export function sha1Hex(input: string): string {
    const bytes = new TextEncoder().encode(input)
    const messageLength = bytes.length
    // message + 0x80 + zero padding + 64-bit big-endian bit length, in
    // 64-byte blocks
    const withOne = messageLength + 1
    const totalLength = withOne + ((120 - (withOne % 64)) % 64) + 8
    const buf = new Uint8Array(totalLength)
    buf.set(bytes)
    buf[messageLength] = 0x80
    const view = new DataView(buf.buffer)
    // JS strings cap well below 2^32 bits, so the high word stays 0
    view.setUint32(
        totalLength - 8,
        Math.floor((messageLength * 8) / 0x100000000),
        false
    )
    view.setUint32(totalLength - 4, (messageLength * 8) >>> 0, false)

    let h0 = 0x67452301
    let h1 = 0xefcdab89
    let h2 = 0x98badcfe
    let h3 = 0x10325476
    let h4 = 0xc3d2e1f0
    const w = new Int32Array(80)
    const rotateLeft = (n: number, b: number): number =>
        (n << b) | (n >>> (32 - b))

    for (let block = 0; block < totalLength; block += 64) {
        for (let i = 0; i < 16; i++) w[i] = view.getInt32(block + i * 4, false)
        for (let i = 16; i < 80; i++)
            w[i] = rotateLeft(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1)
        let a = h0,
            b = h1,
            c = h2,
            d = h3,
            e = h4
        for (let i = 0; i < 80; i++) {
            let f: number, k: number
            if (i < 20) {
                f = (b & c) | (~b & d)
                k = 0x5a827999
            } else if (i < 40) {
                f = b ^ c ^ d
                k = 0x6ed9eba1
            } else if (i < 60) {
                f = (b & c) | (b & d) | (c & d)
                k = 0x8f1bbcdc
            } else {
                f = b ^ c ^ d
                k = 0xca62c1d6
            }
            const t = (rotateLeft(a, 5) + f + e + k + w[i]) | 0
            e = d
            d = c
            c = rotateLeft(b, 30)
            b = a
            a = t
        }
        h0 = (h0 + a) | 0
        h1 = (h1 + b) | 0
        h2 = (h2 + c) | 0
        h3 = (h3 + d) | 0
        h4 = (h4 + e) | 0
    }
    return [h0, h1, h2, h3, h4]
        .map((h) => (h >>> 0).toString(16).padStart(8, "0"))
        .join("")
}
