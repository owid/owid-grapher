import { useCallback, useEffect, useMemo, useState } from "react"
import { CodeSnippet } from "@ourworldindata/components"

const DEFAULT_IFRAME_ASPECT_RATIO = "16 / 10"

function getCurrentPageUrl(): string {
    if (typeof window === "undefined") return ""
    const { origin, pathname, search } = window.location
    return `${origin}${pathname}${search}`
}

function escapeHtmlAttribute(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

function makeIframeCode(url: string): string {
    const escapedUrl = escapeHtmlAttribute(url)
    return `<iframe src="${escapedUrl}" loading="lazy" style="width: 100%; aspect-ratio: ${DEFAULT_IFRAME_ASPECT_RATIO}; border: 0;" allow="web-share; clipboard-write" title="Population projection simulation"></iframe>`
}

function isInIframe(): boolean {
    if (typeof window === "undefined") return false
    try {
        return window.self !== window.top
    } catch {
        return true
    }
}

export function SimulationEmbedButton(): React.ReactElement | null {
    const [isOpen, setIsOpen] = useState(false)
    const [embedUrl, setEmbedUrl] = useState("")

    const onOpen = useCallback(() => {
        setEmbedUrl(getCurrentPageUrl())
        setIsOpen(true)
    }, [])

    if (isInIframe()) return null

    return (
        <>
            <button
                className="demography-embed-button"
                type="button"
                onClick={onOpen}
            >
                Embed
            </button>
            {isOpen && (
                <SimulationEmbedModal
                    embedUrl={embedUrl}
                    onDismiss={() => setIsOpen(false)}
                />
            )}
        </>
    )
}

function SimulationEmbedModal({
    embedUrl,
    onDismiss,
}: {
    embedUrl: string
    onDismiss: () => void
}): React.ReactElement {
    const iframeCode = useMemo(() => makeIframeCode(embedUrl), [embedUrl])

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onDismiss()
        }

        document.addEventListener("keydown", onKeyDown)
        return () => document.removeEventListener("keydown", onKeyDown)
    }, [onDismiss])

    return (
        <div
            className="demography-embed-modal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onDismiss()
            }}
        >
            <div
                className="demography-embed-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="demography-embed-modal-title"
            >
                <div className="demography-embed-modal__header">
                    <h2 id="demography-embed-modal-title">Embed</h2>
                    <button
                        className="demography-embed-modal__close"
                        type="button"
                        onClick={onDismiss}
                        aria-label="Close embed dialog"
                    >
                        ×
                    </button>
                </div>
                <div className="demography-embed-modal__body">
                    <p>
                        To embed this population simulation in another HTML
                        document, paste this code into the page:
                    </p>
                    <CodeSnippet code={iframeCode} forceShowCopyButton />
                </div>
            </div>
        </div>
    )
}
