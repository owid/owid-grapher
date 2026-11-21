import React, {
    useCallback,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import cx from "clsx"
import { match } from "ts-pattern"
import {
    SlideTemplate,
    SlideshowConfig,
    ImageMetadata,
    LinkedAuthor,
    ResolvedSlideChartInfo,
} from "@ourworldindata/types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronLeft,
    faChevronRight,
    faExpand,
    faCompress,
} from "@fortawesome/free-solid-svg-icons"
import { SlideRenderer } from "./SlideRenderer.js"
import { SiteSlideChartEmbed } from "./SiteSlideChartEmbed.js"
import { SlideLogo } from "./SlideLogo.js"
import { useHasHydrated } from "../hooks.js"
import { SlideshowAuthorByline } from "./SlideshowAuthorByline.js"
import { SlideshowMobile } from "./SlideshowMobile.js"

export const _OWID_SLIDESHOW_PROPS = "_OWID_SLIDESHOW_PROPS"

const SLIDESHOW_LAYOUTS = ["deck", "reading", "cards"] as const
type SlideshowLayout = (typeof SLIDESHOW_LAYOUTS)[number]

const PHONE_MEDIA_QUERY = "(max-width: 768px) and (orientation: portrait)"

export interface SlideshowPresentationProps {
    title: string
    authors?: string
    linkedAuthors: LinkedAuthor[]
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    /** Pre-resolved chart type info, keyed by slide URL. Computed at bake time. */
    chartResolutions: Record<string, ResolvedSlideChartInfo>
    /** If true, charts show timeline and controls. */
    interactiveCharts?: boolean
}

/**
 * Interactive slideshow viewer with keyboard navigation.
 * Used on the baked site (hydrated) and importable by the admin editor.
 *
 * All slides are rendered simultaneously and toggled with CSS display.
 * This ensures all chart data is fetched upfront so navigation is instant.
 */
export function SlideshowPresentation(props: {
    title: string
    authors?: string
    linkedAuthors?: LinkedAuthor[]
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    /** Pre-resolved chart type info. If not provided, falls back to client-side resolution. */
    chartResolutions?: Record<string, ResolvedSlideChartInfo>
    /** If true, show timeline and controls on charts. */
    interactiveCharts?: boolean
    /** Override chart rendering (used by admin editor for live MobX sync) */
    renderChart?: (url: string) => React.ReactElement
    /** Controlled slide index (optional — if omitted, manages its own state) */
    currentSlideIndex?: number
    /** Called when the user navigates (optional — for controlled mode) */
    onSlideChange?: (index: number) => void
}): React.ReactElement {
    const {
        authors,
        linkedAuthors,
        slides,
        imageMetadata,
        chartResolutions,
        interactiveCharts,
        renderChart,
    } = props

    // Support both controlled (admin editor) and uncontrolled (baked site) modes.
    // In uncontrolled mode, read the initial slide from the ?slide= query param
    // (1-based) and keep the URL in sync as the user navigates.
    const isControlled = props.currentSlideIndex !== undefined
    const [internalIndex, setInternalIndex] = useState(() => {
        if (isControlled || typeof window === "undefined") return 0
        const param = new URLSearchParams(window.location.search).get("slide")
        if (!param) return 0
        const parsed = parseInt(param, 10)
        if (Number.isNaN(parsed) || parsed < 1) return 0
        return Math.min(parsed - 1, slides.length - 1)
    })
    const currentIndex = props.currentSlideIndex ?? internalIndex
    const setCurrentIndex = props.onSlideChange ?? setInternalIndex

    // When hydrating with a ?slide= param, the server-rendered HTML shows
    // slide 0 but the client initializes to a different slide. Suppress
    // painting until the first client render to avoid a flash of the wrong
    // slide's background.
    const [isHydrated, setIsHydrated] = useState(isControlled)
    // Prototype: phones in portrait get a reflowed layout instead of the
    // scaled deck. ?layout=deck|reading|cards overrides the detection.
    const [layoutState, setLayoutState] = useState<{
        layout: SlideshowLayout
        canSwitch: boolean
    }>({ layout: "deck", canSwitch: false })
    const { layout } = layoutState
    useLayoutEffect(() => {
        // oxlint-disable-next-line react/set-state-in-effect -- flips before the first paint after hydration
        setIsHydrated(true)
        if (isControlled) return
        const layoutFromUrl = getLayoutFromUrl()
        const isPhone = window.matchMedia(PHONE_MEDIA_QUERY).matches
        setLayoutState({
            layout: layoutFromUrl ?? (isPhone ? "reading" : "deck"),
            canSwitch: isPhone || !!layoutFromUrl,
        })
    }, [isControlled])

    const changeLayout = useCallback((layout: SlideshowLayout) => {
        setLayoutState({ layout, canSwitch: true })
        const url = new URL(window.location.href)
        url.searchParams.set("layout", layout)
        window.history.replaceState(null, "", url.toString())
    }, [])

    // Keep the URL ?slide= param in sync (uncontrolled mode only)
    useEffect(() => {
        if (isControlled || typeof window === "undefined") return
        const url = new URL(window.location.href)
        if (currentIndex === 0) {
            url.searchParams.delete("slide")
        } else {
            url.searchParams.set("slide", String(currentIndex + 1))
        }
        window.history.replaceState(null, "", url.toString())
    }, [currentIndex, isControlled])

    const goToPrev = useCallback(() => {
        setCurrentIndex(Math.max(0, currentIndex - 1))
    }, [currentIndex, setCurrentIndex])

    const goToNext = useCallback(() => {
        setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))
    }, [currentIndex, slides.length, setCurrentIndex])

    // Default chart renderer for the baked site: each chart owns
    // its own state (no shared grapherStateRef needed since all
    // slides are mounted simultaneously).
    const defaultRenderChart = useCallback(
        (url: string): React.ReactElement => {
            return (
                <SiteSlideChartEmbed
                    url={url}
                    resolvedInfo={chartResolutions?.[url]}
                    interactiveCharts={interactiveCharts}
                />
            )
        },
        [chartResolutions, interactiveCharts]
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    // Fullscreen isn't available on iPhone, or in iframes that don't allow it.
    // Only checked after hydration to avoid a mismatch.
    const hasHydrated = useHasHydrated()
    const canFullscreen = hasHydrated && !!document.fullscreenEnabled

    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current
        if (!el || !document.fullscreenEnabled) return
        if (!document.fullscreenElement) {
            void el.requestFullscreen()
        } else {
            void document.exitFullscreen()
        }
    }, [])

    // Sync fullscreen state with browser API
    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener("fullscreenchange", handleChange)
        return () =>
            document.removeEventListener("fullscreenchange", handleChange)
    }, [])

    // Consolidated keyboard handler. An effect event, so the listener is only
    // registered once (not torn down on every navigation).
    const handleKeyDown = useEffectEvent((e: KeyboardEvent): void => {
        if (layout === "reading") return
        match(e.key)
            .with("ArrowLeft", "ArrowUp", () => {
                e.preventDefault()
                goToPrev()
            })
            .with("ArrowRight", "ArrowDown", " ", () => {
                e.preventDefault()
                goToNext()
            })
            .with("Escape", () => {
                if (isFullscreen) {
                    void document.exitFullscreen()
                }
            })
            .with("f", () => {
                toggleFullscreen()
            })
            .otherwise(() => undefined)
    })

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    if (slides.length === 0) return <div className="slides" />

    const layoutSwitcher = layoutState.canSwitch && (
        <LayoutSwitcher layout={layout} onChange={changeLayout} />
    )

    if (layout !== "deck") {
        return (
            <>
                <SlideshowMobile
                    layout={layout}
                    slides={slides}
                    imageMetadata={imageMetadata}
                    chartResolutions={chartResolutions}
                    interactiveCharts={interactiveCharts}
                    authors={authors}
                    linkedAuthors={linkedAuthors}
                    currentIndex={currentIndex}
                    onSlideChange={setCurrentIndex}
                />
                {layoutSwitcher}
            </>
        )
    }

    const activeRenderChart = renderChart ?? defaultRenderChart

    const currentSlide = slides[currentIndex]
    const isCoverSlide = currentSlide.template === SlideTemplate.Cover
    const hideLogo = currentSlide.hideLogo ?? false

    return (
        <div
            className={cx("slideshow-container", {
                "slideshow-container--fullscreen": isFullscreen,
                "slideshow-container--cover":
                    currentSlide?.template === SlideTemplate.Cover,
                "slideshow-container--blue-background":
                    currentSlide &&
                    currentSlide.template !== SlideTemplate.Cover &&
                    "blueBackground" in currentSlide &&
                    currentSlide.blueBackground,
            })}
            style={isHydrated ? undefined : { visibility: "hidden" }}
        >
            <div
                ref={containerRef}
                className={cx({
                    "slideshow-slides": true,
                    "slideshow-slides--fullscreen": isFullscreen,
                })}
            >
                {/* All slides are rendered simultaneously and toggled with
                CSS display so that chart data is fetched upfront. */}
                {slides.map((slide, i) => (
                    <SlideRenderer
                        key={i}
                        isHidden={i !== currentIndex}
                        slide={slide}
                        imageMetadata={imageMetadata}
                        renderChart={activeRenderChart}
                    />
                ))}
                {!hideLogo && isCoverSlide && <SlideLogo coverSlideLogo />}
            </div>
            <div className="slideshow-footer">
                <span className="SlideshowPresentation__branding">
                    A presentation by{" "}
                    <SlideshowAuthorByline
                        authors={authors}
                        linkedAuthors={linkedAuthors}
                    />
                </span>
                <div className="SlideshowPresentation__nav">
                    <button
                        className="SlideshowPresentation__nav-button"
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        aria-label="Previous slide"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <span className="slideshow-footer__slide-counter">
                        {currentIndex + 1} / {slides.length}
                    </span>
                    <button
                        className="SlideshowPresentation__nav-button"
                        onClick={goToNext}
                        disabled={currentIndex === slides.length - 1}
                        aria-label="Next slide"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
                {canFullscreen && (
                    <button
                        className="SlideshowPresentation__fullscreen-button"
                        onClick={toggleFullscreen}
                        aria-label={
                            isFullscreen
                                ? "Exit fullscreen"
                                : "Enter fullscreen"
                        }
                    >
                        <FontAwesomeIcon
                            icon={isFullscreen ? faCompress : faExpand}
                        />
                    </button>
                )}
            </div>
            {layoutSwitcher}
        </div>
    )
}

function getLayoutFromUrl(): SlideshowLayout | undefined {
    const param = new URLSearchParams(window.location.search).get("layout")
    return SLIDESHOW_LAYOUTS.find((layout) => layout === param)
}

function LayoutSwitcher(props: {
    layout: SlideshowLayout
    onChange: (layout: SlideshowLayout) => void
}): React.ReactElement {
    return (
        <div className="slideshow-layout-switcher">
            {SLIDESHOW_LAYOUTS.map((layout) => (
                <button
                    key={layout}
                    className={cx("slideshow-layout-switcher__button", {
                        "slideshow-layout-switcher__button--active":
                            layout === props.layout,
                    })}
                    onClick={() => props.onChange(layout)}
                >
                    {layout}
                </button>
            ))}
        </div>
    )
}
