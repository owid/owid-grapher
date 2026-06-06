import { useState, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Toolbar } from "./Toolbar.js"
import { Preview } from "./Preview.js"
import {
    getGdocRaw,
    getGdocAttachments,
    getAdminBaseUrl,
    isAuthError,
    getErrorMessage,
} from "../shared/api.js"
import type {
    Attachments,
    RawGdocDocument,
    ParsedContent,
} from "../shared/types.js"
import { gdocToArchie } from "@owid/db/model/Gdoc/gdocToArchie.js"
import { archieToEnriched } from "@owid/db/model/Gdoc/archieToEnriched.js"
import {
    OwidGdocErrorMessageType,
    type OwidGdocErrorMessage,
} from "@ourworldindata/types"
import type { ParseError } from "@ourworldindata/types/src/gdocTypes/ArchieMlComponents.js"

type LoadingState = "idle" | "loading" | "success" | "error"

interface ParsedContentResult {
    rawDoc: RawGdocDocument
    parsedContent: ParsedContent
}

// Default empty attachments for rendering before attachments are loaded
const emptyAttachments: Attachments = {
    linkedAuthors: [],
    linkedCharts: {},
    linkedIndicators: {},
    linkedDocuments: {},
    imageMetadata: {},
    relatedCharts: [],
    linkedNarrativeCharts: {},
    linkedStaticViz: {},
    tags: [],
}

const getDocIdFromUrl = (url: string | undefined): string | null => {
    if (!url) return null
    const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
    return match ? match[1] : null
}

const adminBaseUrlPromise = getAdminBaseUrl()

async function getActiveTabDocId(): Promise<string | null> {
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    })
    return getDocIdFromUrl(tab?.url)
}

const parseErrorToGdocError = (
    error: ParseError,
    index: number
): OwidGdocErrorMessage => ({
    property: `content.parseErrors[${index}]`,
    type: error.isWarning
        ? OwidGdocErrorMessageType.Warning
        : OwidGdocErrorMessageType.Error,
    message: error.message,
})

function collectParseErrors(value: unknown): ParseError[] {
    if (!value || typeof value !== "object") return []

    const errors: ParseError[] = []
    const objectValue = value as { parseErrors?: unknown }

    if (Array.isArray(objectValue.parseErrors)) {
        errors.push(...(objectValue.parseErrors as ParseError[]))
    }

    if (Array.isArray(value)) {
        for (const item of value) errors.push(...collectParseErrors(item))
        return errors
    }

    for (const child of Object.values(value)) {
        errors.push(...collectParseErrors(child))
    }

    return errors
}

async function fetchAndParseContent(
    docId: string
): Promise<ParsedContentResult> {
    const rawDoc = await getGdocRaw(docId)
    const { text } = await gdocToArchie(rawDoc)
    const content = archieToEnriched(text)
    const errors = collectParseErrors(content).map(parseErrorToGdocError)

    return {
        rawDoc,
        parsedContent: {
            content,
            errors,
        },
    }
}

export function App() {
    const [docId, setDocId] = useState<string | null>(null)
    const [docIdError, setDocIdError] = useState<string | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(false)

    const adminBaseUrlQuery = useQuery({
        queryKey: ["adminBaseUrl"],
        queryFn: () => adminBaseUrlPromise,
    })

    const contentQuery = useQuery({
        queryKey: ["gdocContent", docId],
        queryFn: () => fetchAndParseContent(docId!),
        enabled: !!docId,
        refetchInterval: autoRefresh ? 3000 : false,
    })

    const attachmentsQuery = useQuery({
        queryKey: ["gdocAttachments", docId],
        queryFn: () => getGdocAttachments(docId!),
        enabled: !!docId,
        refetchInterval: autoRefresh ? 60000 : false,
    })

    const fetchDocId = useCallback(async (): Promise<void> => {
        try {
            const activeDocId = await getActiveTabDocId()
            setDocId(activeDocId)
            setDocIdError(
                activeDocId
                    ? null
                    : "Could not get document ID. Make sure you're on a Google Doc."
            )
        } catch (error) {
            console.error("Error getting doc ID:", error)
            setDocId(null)
            setDocIdError("Could not get tab URL. Try refreshing.")
        }
    }, [])

    // Initialize: get doc ID
    useEffect(() => {
        void fetchDocId()
    }, [fetchDocId])

    // Update doc ID when navigating between tabs or docs
    useEffect(() => {
        const handleActivated = (): void => {
            void fetchDocId()
        }

        const handleUpdated = (
            tabId: number,
            changeInfo: chrome.tabs.TabChangeInfo,
            tab: chrome.tabs.Tab
        ): void => {
            if (!tab.active) return
            if (tab.id !== undefined && tab.id !== tabId) return
            if (changeInfo.url || changeInfo.status === "complete") {
                void fetchDocId()
            }
        }

        chrome.tabs.onActivated.addListener(handleActivated)
        chrome.tabs.onUpdated.addListener(handleUpdated)

        return () => {
            chrome.tabs.onActivated.removeListener(handleActivated)
            chrome.tabs.onUpdated.removeListener(handleUpdated)
        }
    }, [fetchDocId])

    const contentError = contentQuery.error
    const attachmentsError = attachmentsQuery.error
    const error = contentError ?? attachmentsError
    const authError = isAuthError(error)
    const parsedContent = contentQuery.data?.parsedContent ?? null
    const contentLoadingState: LoadingState = contentQuery.isPending
        ? "loading"
        : contentQuery.isError
          ? "error"
          : contentQuery.isSuccess
            ? "success"
            : "idle"
    const attachmentsLoadingState: LoadingState = attachmentsQuery.isPending
        ? "loading"
        : attachmentsQuery.isError
          ? "error"
          : attachmentsQuery.isSuccess
            ? "success"
            : "idle"

    if (authError) {
        return (
            <div className="owid-preview-extension">
                <div className="auth-error">
                    <h2>Authentication Required</h2>
                    <p>Please log in to the OWID admin to preview documents.</p>
                    <a
                        href={`${adminBaseUrlQuery.data ?? ""}/admin`}
                        target="_blank"
                        rel="noopener"
                        className="login-link"
                    >
                        Log in to OWID Admin
                    </a>
                    <button
                        onClick={() => void contentQuery.refetch()}
                        className="retry-button"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if ((error || docIdError) && !parsedContent) {
        return (
            <div className="owid-preview-extension">
                <div className="error-state">
                    <h2>Error</h2>
                    <p>{error ? getErrorMessage(error) : docIdError}</p>
                    <button
                        onClick={() => void contentQuery.refetch()}
                        className="retry-button"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if (!docId || (contentLoadingState === "loading" && !parsedContent)) {
        return (
            <div className="owid-preview-extension">
                <div className="loading-state">
                    <p>Loading preview...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="owid-preview-extension">
            <Toolbar
                onRefreshContent={() => void contentQuery.refetch()}
                onRefreshAttachments={() => void attachmentsQuery.refetch()}
                autoRefresh={autoRefresh}
                onToggleAutoRefresh={() => setAutoRefresh((prev) => !prev)}
                contentLoading={contentLoadingState === "loading"}
                attachmentsLoading={attachmentsLoadingState === "loading"}
            />
            {parsedContent && (
                <Preview
                    content={parsedContent.content}
                    attachments={attachmentsQuery.data ?? emptyAttachments}
                    errors={parsedContent.errors}
                />
            )}
        </div>
    )
}
