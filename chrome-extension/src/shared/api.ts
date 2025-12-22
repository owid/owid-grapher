import type { Attachments, RawGdocDocument } from "./types.js"

// For development: use localhost. For production: use admin.owid.io
// TODO: Make this configurable via extension options page
const ADMIN_BASE_URL = "http://localhost:3030"
// const ADMIN_BASE_URL = "https://admin.owid.io"

interface ApiError {
    message: string
    status?: number
}

// Route fetch through background script which has access to chrome.cookies
async function fetchWithAuth<T>(url: string): Promise<T> {
    const response = await chrome.runtime.sendMessage({
        type: "FETCH_API",
        url,
    })

    if (!response.success) {
        const errorMsg = response.error || "Unknown error"
        if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("Unauthorized")) {
            throw {
                message: "Please log in to OWID admin",
                status: 401,
            } as ApiError
        }
        throw {
            message: errorMsg,
        } as ApiError
    }

    return response.data as T
}

export async function getGdocRaw(docId: string): Promise<RawGdocDocument> {
    return fetchWithAuth<RawGdocDocument>(
        `${ADMIN_BASE_URL}/admin/api/gdocs/${docId}/raw`
    )
}

export async function getGdocAttachments(docId: string): Promise<Attachments> {
    return fetchWithAuth<Attachments>(
        `${ADMIN_BASE_URL}/admin/api/gdocs/${docId}/attachments`
    )
}

export function isAuthError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        ((error as ApiError).status === 401 ||
            (error as ApiError).status === 403)
    )
}

export function getErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        return (error as ApiError).message
    }
    return String(error)
}
