import crypto from "crypto"

const DEFAULT_HASH_LENGTH = 8
export const hashBase36 = (
    strOrBuffer: string | Buffer,
    hashLength = DEFAULT_HASH_LENGTH
) => {
    const hashHex = crypto
        .createHash("sha256")
        .update(strOrBuffer)
        .digest("hex")

    // Convert hex to base36 to make it contain more information in fewer characters
    const hashBase36 = BigInt(`0x${hashHex}`).toString(36)
    return hashBase36.substring(0, hashLength)
}
