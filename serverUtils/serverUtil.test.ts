import {
    base64ToBytes,
    bytesToBase64,
    bytesToHex,
    hexToBytes,
} from "./serverUtil.js"
import crypto from "crypto"

function generateRandomBytes(length: number): Uint8Array {
    return crypto.randomBytes(length)
}

describe("hex/base64 conversion is reversible", () => {
    const originalBytes = generateRandomBytes(33)
    const base64String = bytesToBase64(originalBytes)
    const roundTrippedBytes = base64ToBytes(base64String)
    it("is the same after converting to base64 and back", () => {
        expect(originalBytes).toEqual(roundTrippedBytes)
    })

    const hexString = bytesToHex(originalBytes)
    const roundTrippedBytesHex = hexToBytes(hexString)
    it("is the same after converting to hex and back", () => {
        expect(originalBytes).toEqual(roundTrippedBytesHex)
    })
})
