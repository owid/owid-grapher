import type { DetailDictionary } from "@ourworldindata/types"
import type { Attachments, RawGdocDocument } from "./types.js"

export const DEFAULT_ADMIN_BASE_URL = "https://admin.owid.io"

export async function getAdminBaseUrl(): Promise<string> {
    const result = await chrome.storage.sync.get("adminBaseUrl")
    return (result.adminBaseUrl as string) || DEFAULT_ADMIN_BASE_URL
}

interface ApiError {
    message: string
    status?: number
}

interface ApiResponseSuccess<T> {
    success: true
    data: T
}

interface ApiResponseError {
    success: false
    error?: string
    status?: number
}

type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError

// Route fetch through background script which has access to chrome.cookies
async function fetchWithAuth<T>(url: string): Promise<T> {
    const response = (await chrome.runtime.sendMessage({
        type: "FETCH_API",
        url,
    })) as ApiResponse<T> | undefined

    if (!response) {
        throw {
            message: "No response from background script",
            status: 500,
        } as ApiError
    }

    if (!response.success) {
        const status = response.status
        const errorMsg = response.error || "Unknown error"
        if (status === 401 || status === 403) {
            throw {
                message: "Please log in to OWID admin",
                status,
            } as ApiError
        }
        throw {
            message: errorMsg,
            status,
        } as ApiError
    }

    return response.data as T
}

export async function getGdocRaw(docId: string): Promise<RawGdocDocument> {
    const baseUrl = await getAdminBaseUrl()
    return fetchWithAuth<RawGdocDocument>(
        `${baseUrl}/admin/api/gdocs/${docId}/raw`
    )
}

export async function getGdocAttachments(docId: string): Promise<Attachments> {
    const baseUrl = await getAdminBaseUrl()
    return fetchWithAuth<Attachments>(
        `${baseUrl}/admin/api/gdocs/${docId}/attachments`
    )
}

export async function getParsedDods(): Promise<DetailDictionary> {
    const baseUrl = await getAdminBaseUrl()
    return fetchWithAuth<DetailDictionary>(
        `${baseUrl}/admin/api/parsed-dods.json`
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
