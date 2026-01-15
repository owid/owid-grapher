import crypto from "crypto"

export const API_KEY_BYTES = 32

export function createApiKey(): string {
    return crypto.randomBytes(API_KEY_BYTES).toString("base64url")
}

export function hashApiKey(apiKey: string): string {
    return crypto.createHash("sha256").update(apiKey).digest("hex")
}
