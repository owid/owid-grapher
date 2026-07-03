import { type docs_v1, docs as googleDocs } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../../db/OwidGoogleAuth.js"

/**
 * Thrown when a batchUpdate's writeControl.requiredRevisionId no longer
 * matches the live document — i.e. an author edited between our fetch and
 * our write. Callers re-fetch and re-plan rather than retrying blindly.
 */
export class RevisionMismatchError extends Error {
    constructor(documentId: string) {
        super(`document ${documentId} changed since it was fetched`)
        this.name = "RevisionMismatchError"
    }
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503])
const RETRYABLE_NETWORK_CODES = new Set([
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNABORTED",
    "EAI_AGAIN",
])

interface ApiErrorShape {
    response?: { status?: number; data?: unknown }
    code?: number | string
    message?: string
}

function errorStatus(error: unknown): number | string | undefined {
    const shape = error as ApiErrorShape
    return shape.response?.status ?? shape.code
}

function isRetryable(error: unknown): boolean {
    const status = errorStatus(error)
    if (typeof status === "number") return RETRYABLE_STATUS_CODES.has(status)
    if (typeof status === "string") return RETRYABLE_NETWORK_CODES.has(status)
    return false
}

function isRevisionMismatch(error: unknown): boolean {
    const shape = error as ApiErrorShape
    return (
        errorStatus(error) === 400 &&
        (shape.message ?? "").toLowerCase().includes("revision")
    )
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface ThrottledDocsClientOptions {
    /** Max simultaneous in-flight API calls */
    concurrency?: number
    maxAttempts?: number
    /** Injectable for tests */
    client?: docs_v1.Docs
}

/**
 * The only path through which the migration engine talks to the Google Docs
 * API: read-write auth, a concurrency cap, and exponential backoff on
 * rate-limit and transient server errors. There is no throttling anywhere
 * else in the codebase to reuse — bulk runs need this.
 */
export class ThrottledDocsClient {
    private readonly client: docs_v1.Docs
    private readonly concurrency: number
    private readonly maxAttempts: number
    private active = 0
    private readonly waiting: Array<() => void> = []

    constructor(options: ThrottledDocsClientOptions = {}) {
        this.concurrency = options.concurrency ?? 4
        this.maxAttempts = options.maxAttempts ?? 5
        this.client =
            options.client ??
            googleDocs({
                version: "v1",
                auth: OwidGoogleAuth.getGoogleReadWriteAuth(),
            })
    }

    private async acquire(): Promise<void> {
        if (this.active < this.concurrency) {
            this.active++
            return
        }
        await new Promise<void>((resolve) => this.waiting.push(resolve))
        this.active++
    }

    private release(): void {
        this.active--
        const next = this.waiting.shift()
        if (next) next()
    }

    private async withThrottle<T>(
        label: string,
        fn: () => Promise<T>
    ): Promise<T> {
        await this.acquire()
        try {
            for (let attempt = 1; ; attempt++) {
                try {
                    return await fn()
                } catch (error) {
                    if (attempt >= this.maxAttempts || !isRetryable(error))
                        throw error
                    const delay =
                        Math.min(30_000, 1000 * 2 ** (attempt - 1)) *
                        (0.5 + Math.random())
                    console.warn(
                        `${label} failed (attempt ${attempt}/${this.maxAttempts}, status ${String(
                            errorStatus(error)
                        )}), retrying in ${Math.round(delay)}ms`
                    )
                    await sleep(delay)
                }
            }
        } finally {
            this.release()
        }
    }

    /**
     * Fetches with SUGGESTIONS_INLINE: unlike PREVIEW_WITHOUT_SUGGESTIONS,
     * its character indexes match the stored document that batchUpdate
     * operates on, and suggestion markers stay detectable.
     */
    async getDocument(documentId: string): Promise<docs_v1.Schema$Document> {
        return this.withThrottle(`documents.get(${documentId})`, async () => {
            const response = await this.client.documents.get({
                documentId,
                suggestionsViewMode: "SUGGESTIONS_INLINE",
            })
            return response.data
        })
    }

    async batchUpdate(
        documentId: string,
        requests: docs_v1.Schema$Request[],
        requiredRevisionId: string | null
    ): Promise<void> {
        await this.withThrottle(
            `documents.batchUpdate(${documentId})`,
            async () => {
                try {
                    await this.client.documents.batchUpdate({
                        documentId,
                        requestBody: {
                            requests,
                            writeControl: requiredRevisionId
                                ? { requiredRevisionId }
                                : undefined,
                        },
                    })
                } catch (error) {
                    if (isRevisionMismatch(error))
                        throw new RevisionMismatchError(documentId)
                    throw error
                }
            }
        )
    }
}
