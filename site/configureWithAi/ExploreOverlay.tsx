import { useEffect, useEffectEvent, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCheck,
    faFileLines,
    faLink,
    faMagnifyingGlass,
    faWandMagicSparkles,
    faXmark,
} from "@fortawesome/free-solid-svg-icons"
import { copyToClipboard } from "@ourworldindata/utils"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../../settings/clientSettings.mjs"
import {
    pageThumbnailUrl,
    searchUrl,
    sharedQueryUrl,
} from "./configureWithAiView.js"
import type {
    PanelState,
    PanelStore,
    SitePage,
} from "./configureWithAiStore.js"
import { Feedback } from "./Feedback.js"
import { iconForTab } from "./tabIcons.js"

// An answer on other pages, shown over the chart and the side panel so the
// pages get room, as in the prototype's "Explore with AI". It's portalled
// into the Grapher's root, which is positioned, so it covers exactly that.

const KIND_LABEL: Record<SitePage["kind"], string> = {
    chart: "Chart",
    explorer: "Data explorer",
    article: "Article",
    topic: "Topic page",
}

export function ExploreOverlay({
    store,
    state,
    container,
    onClose,
}: {
    store: PanelStore
    state: PanelState
    /** The Grapher's root element */
    container: HTMLElement
    onClose: () => void
}) {
    const { request } = state
    const closeRef = useRef<HTMLButtonElement>(null)
    const onKeyDown = useEffectEvent((e: KeyboardEvent): void => {
        if (e.key === "Escape") onClose()
    })

    useEffect(() => {
        closeRef.current?.focus({ preventScroll: true })
        const listener = (e: KeyboardEvent): void => onKeyDown(e)
        document.addEventListener("keydown", listener)
        return () => document.removeEventListener("keydown", listener)
    }, [])

    // Follow-up questions go in the side panel, so the overlay only ever
    // shows an answer: a second search box would make this read as site
    // search rather than a view of this chart
    if (request.status !== "pages") return null
    const searchQuery = request.searchQuery ?? request.query
    return createPortal(
        <div
            className="configure-with-ai-overlay"
            role="dialog"
            aria-label="Explore with AI"
        >
            <div className="configure-with-ai-overlay__header">
                <p className="configure-with-ai-overlay__title">
                    <FontAwesomeIcon icon={faWandMagicSparkles} />
                    Explore with AI <em>(beta)</em>
                </p>
                <div className="configure-with-ai-overlay__actions">
                    <CopyLinkButton query={request.query} />
                    <button
                        className="configure-with-ai-overlay__close"
                        type="button"
                        ref={closeRef}
                        onClick={onClose}
                    >
                        Back to the chart
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            </div>
            <div className="configure-with-ai-overlay__body">
                {request.message && (
                    <p className="configure-with-ai-overlay__message">
                        {request.message}
                    </p>
                )}
                <ul className="configure-with-ai-overlay__grid">
                    {request.pages.map((page) => (
                        <li key={page.url}>
                            <PageCard page={page} />
                        </li>
                    ))}
                </ul>
                <a
                    className="configure-with-ai-overlay__search-link"
                    href={searchUrl(searchQuery)}
                >
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                    Or search all results for “{searchQuery}”
                </a>
            </div>
            <div className="configure-with-ai-overlay__footer">
                <Feedback
                    store={store}
                    feedback={request.feedback}
                    prompt="Is this tool useful for you?"
                />
            </div>
        </div>,
        container
    )
}

/**
 * Copies a link that asks the same question when opened. The answer is asked
 * again, so it can differ a little from this one.
 */
function CopyLinkButton({ query }: { query: string }) {
    const [isCopied, setIsCopied] = useState(false)

    useEffect(() => {
        if (!isCopied) return
        const timer = setTimeout(() => setIsCopied(false), 2000)
        return () => clearTimeout(timer)
    }, [isCopied])

    return (
        <button
            className="configure-with-ai-overlay__copy"
            type="button"
            onClick={async () => {
                if (await copyToClipboard(sharedQueryUrl(query)))
                    setIsCopied(true)
            }}
        >
            <FontAwesomeIcon icon={isCopied ? faCheck : faLink} />
            {isCopied ? "Link copied" : "Copy link"}
        </button>
    )
}

function PageCard({ page }: { page: SitePage }) {
    const src = pageThumbnailUrl(GRAPHER_DYNAMIC_THUMBNAIL_URL, page)
    const [hasFailed, setHasFailed] = useState(false)
    const isData = page.kind === "chart" || page.kind === "explorer"
    // A variant shows under the name of the data page it belongs to
    const title = page.page ?? page.title
    const subtitle = page.page && page.page !== page.title ? page.title : null
    return (
        <a
            className="configure-with-ai-overlay__card"
            href={page.url}
            target="_blank"
            rel="noopener"
        >
            <span className="configure-with-ai-overlay__thumb">
                {src && !hasFailed ? (
                    <img
                        src={src}
                        alt=""
                        loading="lazy"
                        onError={() => setHasFailed(true)}
                    />
                ) : (
                    <FontAwesomeIcon
                        icon={
                            isData
                                ? iconForTab(page.tab ?? "line")
                                : faFileLines
                        }
                    />
                )}
            </span>
            <span className="configure-with-ai-overlay__card-body">
                <span className="configure-with-ai-overlay__kind">
                    {KIND_LABEL[page.kind]}
                </span>
                <span className="configure-with-ai-overlay__card-title">
                    {title}
                </span>
                {(subtitle || page.variant) && (
                    <span className="configure-with-ai-overlay__variant">
                        {[subtitle, page.variant].filter(Boolean).join(" · ")}
                    </span>
                )}
                {isData && page.label !== page.title && (
                    <span className="configure-with-ai-overlay__label">
                        {page.label}
                    </span>
                )}
                {page.why && (
                    <span className="configure-with-ai-overlay__why">
                        {page.why}
                    </span>
                )}
                <span className="configure-with-ai-overlay__go">
                    Open on Our World in Data ↗
                </span>
            </span>
        </a>
    )
}
