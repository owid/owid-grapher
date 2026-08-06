import { EMAIL_NOTIFICATIONS_API_BASE_URL } from "../../settings/clientSettings.js"

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again."

/** The envelope every email-notifications endpoint answers with. */
interface ApiResponse {
    ok?: boolean
    error?: string
}

/**
 * Both helpers hand back the raw response alongside the parsed body, because
 * callers need the status as well as the body: 410 marks an expired magic link
 * and drives its own screen rather than an error message. That's also why they
 * don't use `fetchJson` from utils, which throws on a non-ok response before
 * the body - and the `error` message it carries - can be read.
 */
async function requestJson<T extends ApiResponse>(
    path: string,
    init?: RequestInit
): Promise<{ response: Response; json: T }> {
    const response = await fetch(
        `${EMAIL_NOTIFICATIONS_API_BASE_URL}${path}`,
        init
    )
    const json: T = await response.json()
    return { response, json }
}

export async function apiGet<T extends ApiResponse>(
    path: string,
    params: Record<string, string>
): Promise<{ response: Response; json: T }> {
    const query = new URLSearchParams(params).toString()
    return requestJson<T>(`${path}?${query}`)
}

export async function apiPost<T extends ApiResponse>(
    path: string,
    body: unknown
): Promise<{ response: Response; json: T }> {
    return requestJson<T>(path, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
}

/** An error response from the API, carrying a message meant for the user. */
class ApiError extends Error {}

export function throwIfApiError(response: Response, json: ApiResponse): void {
    if (!response.ok || !json.ok)
        throw new ApiError(json.error ?? GENERIC_ERROR_MESSAGE)
}

/**
 * Only ApiError messages are shown to the user; anything else (a fetch
 * TypeError when the API is unreachable, a JSON parse error on a non-JSON
 * response) gets the generic message.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof ApiError ? error.message : GENERIC_ERROR_MESSAGE
}
