import { EMAIL_NOTIFICATIONS_API_BASE_URL } from "../../settings/clientSettings.js"

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again."

/**
 * These return the raw response rather than using `fetchJson` from utils,
 * because callers need the status: 410 marks an expired magic link and drives
 * its own screen rather than an error message, and `fetchJson` throws on a
 * non-ok response before the body — and the `error` message it carries — can
 * be read.
 */
export function apiGet(
    path: string,
    params: Record<string, string>
): Promise<Response> {
    const query = new URLSearchParams(params).toString()
    return fetch(`${EMAIL_NOTIFICATIONS_API_BASE_URL}${path}?${query}`)
}

export function apiPost(path: string, body: unknown): Promise<Response> {
    return fetch(`${EMAIL_NOTIFICATIONS_API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
}

/** Turns a non-ok response into an Error carrying the API's `error` message. */
export async function throwIfApiError(response: Response): Promise<void> {
    if (response.ok) return
    const json: { error?: string } | null = await response
        .json()
        .catch(() => null)
    throw new Error(json?.error ?? GENERIC_ERROR_MESSAGE)
}

export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE
}
