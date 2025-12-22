import React, { useState, useEffect, useCallback, useRef } from "react"
import { Toolbar } from "./Toolbar.js"
import { Preview } from "./Preview.js"
import { getGdocRaw, getGdocAttachments, isAuthError, getErrorMessage } from "../shared/api.js"
import type { Attachments, RawGdocDocument, ParsedContent } from "../shared/types.js"
import { gdocToArchie } from "@owid/db/model/Gdoc/gdocToArchie.js"
import { archieToEnriched } from "@owid/db/model/Gdoc/archieToEnriched.js"

type LoadingState = "idle" | "loading" | "success" | "error"

interface AppState {
    docId: string | null
    rawDoc: RawGdocDocument | null
    parsedContent: ParsedContent | null
    attachments: Attachments | null
    contentLoadingState: LoadingState
    attachmentsLoadingState: LoadingState
    error: string | null
    authError: boolean
}

const initialState: AppState = {
    docId: null,
    rawDoc: null,
    parsedContent: null,
    attachments: null,
    contentLoadingState: "idle",
    attachmentsLoadingState: "idle",
    error: null,
    authError: false,
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

export function App() {
    const [state, setState] = useState<AppState>(initialState)
    const [autoRefresh, setAutoRefresh] = useState(false)
    const contentIntervalRef = useRef<number | null>(null)
    const attachmentsIntervalRef = useRef<number | null>(null)

    // Get doc ID directly from the active tab's URL
    const fetchDocId = useCallback(async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
            if (tab?.url) {
                const match = tab.url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
                if (match) {
                    setState((prev) => ({ ...prev, docId: match[1] }))
                    return
                }
            }
            setState((prev) => ({
                ...prev,
                error: "Could not get document ID. Make sure you're on a Google Doc.",
            }))
        } catch (error) {
            console.error("Error getting doc ID:", error)
            setState((prev) => ({
                ...prev,
                error: "Could not get tab URL. Try refreshing.",
            }))
        }
    }, [])

    // Fetch and parse raw content
    const fetchContent = useCallback(async () => {
        if (!state.docId) return

        setState((prev) => ({
            ...prev,
            contentLoadingState: "loading",
            error: null,
            authError: false,
        }))

        try {
            // 1. Fetch raw Google Doc
            const rawDoc = await getGdocRaw(state.docId)

            // 2. Convert to ArchieML text
            const { text } = await gdocToArchie(rawDoc)

            // 3. Parse to enriched blocks
            const content = archieToEnriched(text)

            setState((prev) => ({
                ...prev,
                rawDoc,
                parsedContent: {
                    content,
                    errors: [], // TODO: collect errors from parsing
                },
                contentLoadingState: "success",
            }))
        } catch (error) {
            console.error("Error fetching content:", error)
            setState((prev) => ({
                ...prev,
                contentLoadingState: "error",
                authError: isAuthError(error),
                error: getErrorMessage(error),
            }))
        }
    }, [state.docId])

    // Fetch attachments
    const fetchAttachments = useCallback(async () => {
        if (!state.docId) return

        setState((prev) => ({ ...prev, attachmentsLoadingState: "loading" }))

        try {
            const attachments = await getGdocAttachments(state.docId)
            setState((prev) => ({
                ...prev,
                attachments,
                attachmentsLoadingState: "success",
            }))
        } catch (error) {
            console.error("Error fetching attachments:", error)
            // Don't overwrite content error with attachments error
            setState((prev) => ({
                ...prev,
                attachmentsLoadingState: "error",
                // Only set error if we don't already have one
                error: prev.error || getErrorMessage(error),
                authError: prev.authError || isAuthError(error),
            }))
        }
    }, [state.docId])

    // Initialize: get doc ID
    useEffect(() => {
        fetchDocId()
    }, [fetchDocId])

    // When doc ID is available, fetch content and attachments
    useEffect(() => {
        if (state.docId) {
            fetchContent()
            fetchAttachments()
        }
    }, [state.docId, fetchContent, fetchAttachments])

    // Auto-refresh management
    useEffect(() => {
        if (autoRefresh && state.docId) {
            // Content refresh every 3 seconds
            contentIntervalRef.current = window.setInterval(() => {
                fetchContent()
            }, 3000)

            // Attachments refresh every 60 seconds
            attachmentsIntervalRef.current = window.setInterval(() => {
                fetchAttachments()
            }, 60000)
        }

        return () => {
            if (contentIntervalRef.current) {
                clearInterval(contentIntervalRef.current)
            }
            if (attachmentsIntervalRef.current) {
                clearInterval(attachmentsIntervalRef.current)
            }
        }
    }, [autoRefresh, state.docId, fetchContent, fetchAttachments])

    const handleRefreshContent = useCallback(() => {
        fetchContent()
    }, [fetchContent])

    const handleRefreshAttachments = useCallback(() => {
        fetchAttachments()
    }, [fetchAttachments])

    const handleToggleAutoRefresh = useCallback(() => {
        setAutoRefresh((prev) => !prev)
    }, [])

    // Render auth error state
    if (state.authError) {
        return (
            <div className="owid-preview-extension">
                <div className="auth-error">
                    <h2>Authentication Required</h2>
                    <p>Please log in to the OWID admin to preview documents.</p>
                    <a
                        href="https://admin.owid.io/admin"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="login-link"
                    >
                        Log in to OWID Admin
                    </a>
                    <button onClick={handleRefreshContent} className="retry-button">
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    // Render error state
    if (state.error && !state.parsedContent) {
        return (
            <div className="owid-preview-extension">
                <div className="error-state">
                    <h2>Error</h2>
                    <p>{state.error}</p>
                    <button onClick={handleRefreshContent} className="retry-button">
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    // Render loading state
    if (!state.docId || state.contentLoadingState === "loading" && !state.parsedContent) {
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
                onRefreshContent={handleRefreshContent}
                onRefreshAttachments={handleRefreshAttachments}
                autoRefresh={autoRefresh}
                onToggleAutoRefresh={handleToggleAutoRefresh}
                contentLoading={state.contentLoadingState === "loading"}
                attachmentsLoading={state.attachmentsLoadingState === "loading"}
            />
            {state.parsedContent && (
                <Preview
                    content={state.parsedContent.content}
                    attachments={state.attachments || emptyAttachments}
                    errors={state.parsedContent.errors}
                />
            )}
        </div>
    )
}
