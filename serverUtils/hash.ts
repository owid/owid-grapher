import { isNil } from "@ourworldindata/utils"
import crypto, { Hash } from "crypto"
import { pipeline } from "node:stream/promises"

export const hashMd5 = (
    strOrBuffer: string | Buffer,
    hashLength?: number | null
) => {
    const hash = crypto.createHash("md5").update(strOrBuffer)
    return _hashHex(hash, hashLength)
}

const DEFAULT_HASH_LENGTH = 8

const _hashHex = (hash: Hash, hashLength: number | null | undefined) => {
    const hashHex = hash.digest("hex")
    if (isNil(hashLength)) return hashHex
    else return hashHex.substring(0, hashLength)
}

export const hashHex = (
    strOrBuffer: string | Buffer,
    hashLength: number | null = DEFAULT_HASH_LENGTH
) => {
    const hash = crypto.createHash("sha256").update(strOrBuffer)
    return _hashHex(hash, hashLength)
}

const _hashBase36 = (hash: Hash, hashLength: number | null | undefined) => {
    const hashHex = hash.digest("hex")

    // Convert hex to base36 to make it contain more information in fewer characters
    const hashBase36 = BigInt(`0x${hashHex}`).toString(36)
    if (isNil(hashLength)) return hashBase36
    else return hashBase36.substring(0, hashLength)
}

export const hashBase36 = (
    strOrBuffer: string | Buffer,
    hashLength: number | null = DEFAULT_HASH_LENGTH
) => {
    const hash = crypto.createHash("sha256").update(strOrBuffer)

    return _hashBase36(hash, hashLength)
}

export const hashBase36FromStream = async (
    stream: NodeJS.ReadableStream,
    hashLength: number | null = DEFAULT_HASH_LENGTH
) => {
    const hash = crypto.createHash("sha256")

    await pipeline(stream, hash)
    hash.end()

    return _hashBase36(hash, hashLength)
}
