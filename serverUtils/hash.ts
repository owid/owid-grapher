import crypto, { Hash } from "crypto"
import { pipeline } from "node:stream/promises"

const DEFAULT_HASH_LENGTH = 8

const _hashBase36 = (hash: Hash, hashLength = DEFAULT_HASH_LENGTH) => {
    const hashHex = hash.digest("hex")

    // Convert hex to base36 to make it contain more information in fewer characters
    const hashBase36 = BigInt(`0x${hashHex}`).toString(36)
    return hashBase36.substring(0, hashLength)
}

export const hashBase36 = (
    strOrBuffer: string | Buffer,
    hashLength = DEFAULT_HASH_LENGTH
) => {
    const hash = crypto.createHash("sha256").update(strOrBuffer)

    return _hashBase36(hash, hashLength)
}

export const hashBase36FromStream = async (
    stream: NodeJS.ReadableStream,
    hashLength = DEFAULT_HASH_LENGTH
) => {
    const hash = crypto.createHash("sha256")

    await pipeline(stream, hash)
    hash.end()

    return _hashBase36(hash, hashLength)
}
