import {
    useContext,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCheck,
    faCopy,
    faDesktop,
    faMobileScreen,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { AdminAppContext } from "./AdminAppContext.js"
import { buildAddComponentPrompt } from "./gdocsReferencePrompt.js"

/**
 * Message posted by the preview page (see
 * adminSiteServer/gdocsReferencePreview.tsx) whenever its rendered height
 * changes, so the embedding iframe can be sized to fit.
 */
const PREVIEW_HEIGHT_MESSAGE = "owid-gdocs-ref-preview-height"

const INITIAL_PREVIEW_HEIGHT = 200

// The preview always renders at a real site viewport width and is scaled to
// fit the pane — otherwise layout components (side-by-side, sticky-left, …)
// would collapse into their mobile single-column rendering.
const DESKTOP_VIEWPORT_WIDTH = 1280
const MOBILE_VIEWPORT_WIDTH = 375

type PreviewViewport = "desktop" | "mobile"

/** A button that copies the given text and briefly confirms it did. */
export function CopyButton({
    text,
    label = "Copy",
    className,
    icon = faCopy,
    title,
}: {
    text: string
    label?: string
    className?: string
    icon?: IconDefinition
    title?: string
}): React.ReactElement {
    const [copied, setCopied] = useState(false)
    const onCopy = (): void => {
        void navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }
    return (
        <button
            className={className}
            type="button"
            title={title}
            onClick={onCopy}
        >
            <FontAwesomeIcon icon={copied ? faCheck : icon} />{" "}
            {copied ? "Copied" : label}
        </button>
    )
}

/**
 * Copies a ready-to-paste prompt for an ongoing Claude conversation asking it
 * to add this component to the doc the author is working on.
 */
export function CopyPromptButton({
    componentId,
    archie,
    className,
}: {
    componentId: string
    archie: string
    className?: string
}): React.ReactElement {
    return (
        <CopyButton
            text={buildAddComponentPrompt(componentId, archie)}
            label="Copy prompt"
            icon={faWandMagicSparkles}
            title="Copy a prompt asking Claude to add this component to the doc you're working on"
            className={className}
        />
    )
}

function TabButton({
    label,
    isActive,
    onClick,
}: {
    label: string
    isActive: boolean
    onClick: () => void
}): React.ReactElement {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            className={
                isActive
                    ? "gdocs-ref-example__tab gdocs-ref-example__tab--active"
                    : "gdocs-ref-example__tab"
            }
            onClick={onClick}
        >
            {label}
        </button>
    )
}

/**
 * A single ArchieML example: a [Preview | ArchieML] tab pair with an
 * always-available Copy button. The preview is the example rendered through
 * the real gdoc pipeline (server route under /admin/gdocs-reference/…),
 * embedded in an iframe that sizes itself to the rendered content. A
 * desktop/mobile toggle switches the preview between the site's two layouts.
 *
 * When no previewPath is given (e.g. a plain non-archie code fence), only the
 * code is shown.
 */
export function GdocsReferenceExample({
    archie,
    previewPath,
    componentId,
}: {
    archie: string
    previewPath?: string
    /** When given, offers a "Copy prompt" button targeting this component */
    componentId?: string
}): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const [tab, setTab] = useState<"preview" | "archie">(
        previewPath ? "preview" : "archie"
    )
    const [viewport, setViewport] = useState<PreviewViewport>("desktop")
    const [contentHeight, setContentHeight] = useState(INITIAL_PREVIEW_HEIGHT)
    const [paneWidth, setPaneWidth] = useState<number | undefined>(undefined)
    const frameWrapRef = useRef<HTMLDivElement>(null)
    // Identifies this widget's iframe among the height messages arriving from
    // every preview on the page.
    const pid = useId()

    useEffect(() => {
        if (!previewPath) return
        const onMessage = (event: MessageEvent): void => {
            if (event.origin !== window.location.origin) return
            const data = event.data as {
                type?: string
                pid?: string
                height?: number
            }
            if (data?.type !== PREVIEW_HEIGHT_MESSAGE || data.pid !== pid)
                return
            if (typeof data.height === "number" && data.height > 0)
                setContentHeight(Math.ceil(data.height))
        }
        window.addEventListener("message", onMessage)
        return () => window.removeEventListener("message", onMessage)
    }, [pid, previewPath])

    // Track the pane width so the desktop-width preview can be scaled to fit.
    useLayoutEffect(() => {
        if (!previewPath) return
        const element = frameWrapRef.current
        if (!element) return
        const measure = (): void => setPaneWidth(element.clientWidth)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [previewPath])

    const previewUrl = previewPath
        ? `${admin.basePath}${previewPath}${
              previewPath.includes("?") ? "&" : "?"
          }pid=${encodeURIComponent(pid)}`
        : undefined

    const viewportWidth =
        viewport === "desktop" ? DESKTOP_VIEWPORT_WIDTH : MOBILE_VIEWPORT_WIDTH
    const scale = paneWidth ? Math.min(1, paneWidth / viewportWidth) : 1

    return (
        <div className="gdocs-ref-example">
            <div className="gdocs-ref-example__toolbar">
                {previewUrl ? (
                    <div
                        className="gdocs-ref-example__tabs"
                        role="tablist"
                        aria-label="Example view"
                    >
                        <TabButton
                            label="Preview"
                            isActive={tab === "preview"}
                            onClick={() => setTab("preview")}
                        />
                        <TabButton
                            label="ArchieML"
                            isActive={tab === "archie"}
                            onClick={() => setTab("archie")}
                        />
                    </div>
                ) : (
                    <div className="gdocs-ref-example__tabs" />
                )}
                <div className="gdocs-ref-example__toolbar-right">
                    {previewUrl && tab === "preview" && (
                        <div className="gdocs-ref-example__viewports">
                            <button
                                type="button"
                                title="Desktop layout"
                                aria-pressed={viewport === "desktop"}
                                className={
                                    viewport === "desktop"
                                        ? "gdocs-ref-example__viewport gdocs-ref-example__viewport--active"
                                        : "gdocs-ref-example__viewport"
                                }
                                onClick={() => setViewport("desktop")}
                            >
                                <FontAwesomeIcon icon={faDesktop} />
                            </button>
                            <button
                                type="button"
                                title="Mobile layout"
                                aria-pressed={viewport === "mobile"}
                                className={
                                    viewport === "mobile"
                                        ? "gdocs-ref-example__viewport gdocs-ref-example__viewport--active"
                                        : "gdocs-ref-example__viewport"
                                }
                                onClick={() => setViewport("mobile")}
                            >
                                <FontAwesomeIcon icon={faMobileScreen} />
                            </button>
                        </div>
                    )}
                    <CopyButton
                        text={archie}
                        className="gdocs-ref-example__copy"
                    />
                    {componentId && (
                        <CopyPromptButton
                            componentId={componentId}
                            archie={archie}
                            className="gdocs-ref-example__copy"
                        />
                    )}
                </div>
            </div>
            {previewUrl && (
                // Kept mounted when the code tab is active so switching back
                // does not reload the preview.
                <div
                    ref={frameWrapRef}
                    className={
                        viewport === "mobile"
                            ? "gdocs-ref-example__frame-wrap gdocs-ref-example__frame-wrap--mobile"
                            : "gdocs-ref-example__frame-wrap"
                    }
                    style={{
                        display: tab === "preview" ? undefined : "none",
                        height: Math.ceil(contentHeight * scale),
                    }}
                >
                    <iframe
                        className="gdocs-ref-example__iframe"
                        src={previewUrl}
                        loading="lazy"
                        title="Rendered example"
                        style={{
                            width: viewportWidth,
                            height: contentHeight,
                            transform: `scale(${scale})`,
                        }}
                    />
                </div>
            )}
            {(tab === "archie" || !previewUrl) && (
                <pre className="gdocs-ref-example__code">
                    <code>{archie}</code>
                </pre>
            )}
        </div>
    )
}
