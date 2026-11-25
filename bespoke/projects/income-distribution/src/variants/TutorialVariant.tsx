import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import * as R from "remeda"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString } from "nuqs"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import type {
    BespokeComponentDataUrls,
    BespokeVariantProps,
} from "owid-bespoke-types"

import type { IncomeDistributionConfig } from "../index.js"
import { NARROW_BREAKPOINT, REGION_COLORS } from "../core/constants.js"
import { queryClient } from "../core/data.js"
import { assignCountryColors } from "../core/chartModel.js"
import { chartSubtitle, chartTitle } from "../core/chartText.js"
import {
    useIncomeDistributionState,
    type ChartState,
    type ChartStateSetters,
    type IncomeDistributionState,
} from "../core/useIncomeDistributionState.js"
import {
    clampSlide,
    findWalkthrough,
    resolveSlideChartState,
    resolveSlideText,
    WALKTHROUGHS,
    type SlideChartField,
    type Walkthrough,
    type WalkthroughSlide,
} from "../core/walkthroughs.js"
import type { IncomeDistributionYear } from "../core/types.js"
import {
    IncomeDistributionControls,
    MeasuredInControl,
    useIncomeDistributionControlsProps,
    ViewControl,
    type IncomeDistributionControlsProps,
} from "../components/IncomeDistributionControls.js"
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ConfigureDrawer } from "../components/ConfigureDrawer.js"
import { IncomeDistributionFrame } from "../components/IncomeDistributionFrame.js"
import type { ChartAnnotation } from "../components/IncomeDistributionChart.js"
import {
    RichText,
    SlideFooter,
    SlideHeader,
    SlideSideNav,
    type SlideHeaderPage,
} from "../components/Walkthrough.js"
import { CountryMultiSelect } from "../components/CountryMultiSelect.js"
import { placeholderWelfareType } from "../core/welfareType.js"
import {
    WalkthroughPills,
    WalkthroughRail,
    type WalkthroughProgress,
} from "../components/WalkthroughRail.js"

/** From this container width on, the walkthroughs sit in a rail left of the chart */
const RAIL_BREAKPOINT = 900
/** The rail's width and the gap after it (TutorialVariant.scss) */
const RAIL_WIDTH = 193
const RAIL_GAP = 32

/** A horizontal swipe longer than this, and mostly sideways, changes the slide */
const SWIPE_DISTANCE = 50

export function TutorialVariant({
    config,
    urls,
}: BespokeVariantProps<IncomeDistributionConfig>): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <FetchingTutorialVariant config={config} urls={urls} />
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function FetchingTutorialVariant({
    config,
    urls,
}: {
    config: IncomeDistributionConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const state = useIncomeDistributionState(config, urls)

    if (state.status === "pending")
        return <ChartSkeleton className="income-distribution-chart-box" />
    if (state.status === "error" || !state.metadata || !state.yearData)
        return <ChartError className="income-distribution-chart-box" />

    return (
        <CaptionedTutorialVariant
            config={config}
            state={state}
            metadata={state.metadata}
            yearData={state.yearData}
        />
    )
}

/**
 * State that belongs to one slide and is dropped when the slide changes: a
 * poverty line the reader dragged on it, and the fields its control handed
 * back to the reader's own state
 */
interface SlideLocalState {
    slideKey: string
    povertyLine?: number | null
    released: ReadonlySet<SlideChartField>
}

function CaptionedTutorialVariant({
    config,
    state,
    metadata,
    yearData,
}: {
    config: IncomeDistributionConfig
    state: IncomeDistributionState
    metadata: NonNullable<IncomeDistributionState["metadata"]>
    yearData: IncomeDistributionYear
}): React.ReactElement {
    const { width, node, ref } = useContainerWidth()
    const hasRail = width >= RAIL_BREAKPOINT
    const columnWidth = hasRail ? width - RAIL_WIDTH - RAIL_GAP : width
    const isNarrow = width > 0 && columnWidth < NARROW_BREAKPOINT
    const { chartState: readerState, setters } = state

    // Which walkthrough is playing and on which slide, in the URL so a
    // slide can be shared
    const [walkthroughId, setWalkthroughId] = useUrlState({
        key: "walkthrough",
        parser: parseAsString,
        defaultValue: config.walkthrough ?? "",
    })
    const [rawSlide, setRawSlide] = useUrlState({
        key: "slide",
        parser: parseAsInteger,
        defaultValue: 1,
    })
    const walkthrough = findWalkthrough(walkthroughId)
    const slideNumber = walkthrough ? clampSlide(rawSlide, walkthrough) : 1
    const slide = walkthrough?.slides[slideNumber - 1]
    const slideKey = walkthrough ? `${walkthrough.id}:${slideNumber}` : ""

    const [watchedIds, setWatchedIds] = useState<ReadonlySet<string>>(
        () => new Set()
    )
    const [storedSlideState, setSlideState] = useState<SlideLocalState>({
        slideKey: "",
        released: new Set(),
    })
    const slideState = useMemo(
        (): SlideLocalState =>
            storedSlideState.slideKey === slideKey
                ? storedSlideState
                : { slideKey, released: new Set() },
        [storedSlideState, slideKey]
    )
    const updateSlideState = useCallback(
        (update: (current: SlideLocalState) => Partial<SlideLocalState>) =>
            setSlideState((stored) => {
                const current =
                    stored.slideKey === slideKey
                        ? stored
                        : { slideKey, released: new Set<SlideChartField>() }
                return { ...current, ...update(current) }
            }),
        [slideKey]
    )

    // Once a walkthrough the reader started is on screen, bring the whole
    // frame into view, from the slide's text to the buttons below the chart
    const chartRef = useRef<HTMLDivElement>(null)
    const shouldScrollIntoViewRef = useRef(false)
    const open = useCallback(
        (id: string) => {
            shouldScrollIntoViewRef.current = true
            setWalkthroughId(id)
            setRawSlide(1)
        },
        [setWalkthroughId, setRawSlide]
    )
    useEffect(() => {
        if (!walkthrough || !shouldScrollIntoViewRef.current) return
        shouldScrollIntoViewRef.current = false
        const element = chartRef.current
        if (!element) return
        scrollIntoViewIfCutOff(element)
    }, [walkthrough])
    const close = useCallback(() => {
        if (walkthrough && slideNumber >= walkthrough.slides.length)
            setWatchedIds((ids) => new Set([...ids, walkthrough.id]))
        setWalkthroughId("")
        setRawSlide(1)
    }, [walkthrough, slideNumber, setWalkthroughId, setRawSlide])
    const toggle = useCallback(
        (id: string) => (walkthrough?.id === id ? close() : open(id)),
        [walkthrough, close, open]
    )
    const goTo = useCallback(
        (next: number) => {
            if (!walkthrough) return
            setRawSlide(clampSlide(next, walkthrough))
        },
        [walkthrough, setRawSlide]
    )
    const previous = useCallback(
        () => goTo(slideNumber - 1),
        [goTo, slideNumber]
    )
    const next = useCallback(() => goTo(slideNumber + 1), [goTo, slideNumber])

    useWalkthroughKeyboard({
        isOpen: !!walkthrough,
        onPrevious: previous,
        onNext: next,
        onClose: close,
    })
    const swipeHandlers = useSwipe({
        isEnabled: !!walkthrough,
        onPrevious: previous,
        onNext: next,
    })

    // The slide's state over the reader's own; a line dragged on the slide
    // stays on the slide
    const chartState = useMemo((): ChartState => {
        if (!slide) return readerState
        const resolved = resolveSlideChartState(
            readerState,
            slide.chart,
            slideState.released,
            (name) => yearData.byName.has(name)
        )
        return slideState.povertyLine !== undefined
            ? { ...resolved, povertyLine: slideState.povertyLine }
            : resolved
    }, [slide, readerState, slideState, yearData])

    // A slide's control writes to the reader's state, and from then on the
    // slide shows what the reader picked
    const release = useCallback(
        (field: SlideChartField) =>
            updateSlideState((current) => ({
                released: new Set([...current.released, field]),
            })),
        [updateSlideState]
    )
    const slideSetters = useMemo(
        (): ChartStateSetters => ({
            ...setters,
            setView: (view) => {
                setters.setView(view)
                release("view")
            },
            setSelectedCountries: (names) => {
                setters.setSelectedCountries(names)
                release("countries")
            },
            setTimeInterval: (interval) => {
                setters.setTimeInterval(interval)
                release("timeInterval")
            },
            setCurrency: (key) => {
                setters.setCurrency(key)
                release("currency")
            },
            setPovertyLine: (line) =>
                updateSlideState(() => ({ povertyLine: line })),
        }),
        [setters, release, updateSlideState]
    )

    const controlsProps = useIncomeDistributionControlsProps({
        chartState: readerState,
        setters,
        currencies: state.currencies,
        suggestedCurrency: state.suggestedCurrency,
        isNarrow,
    })
    const slideControlsProps = useIncomeDistributionControlsProps({
        chartState,
        setters: slideSetters,
        currencies: state.currencies,
        suggestedCurrency: state.suggestedCurrency,
        isNarrow,
    })

    const shouldHideControls =
        config.hideControls || !!config.title || !!config.subtitle
    const progress: WalkthroughProgress = {
        activeId: walkthrough?.id ?? null,
        slide: slideNumber,
        watchedIds,
    }

    // Narrow charts: in front of the pills, the drawer's button, or, while a
    // walkthrough plays, the way out of it
    const leadingButton = walkthrough ? (
        <button
            type="button"
            className="income-distribution-configure-button"
            onClick={close}
        >
            <FontAwesomeIcon
                icon={faArrowRightFromBracket}
                className="income-distribution-configure-button__icon"
            />
            Exit tutorial &amp; explore
        </button>
    ) : (
        !shouldHideControls && (
            <ConfigureDrawer container={node}>
                <IncomeDistributionControls
                    {...controlsProps}
                    layout="drawer"
                />
            </ConfigureDrawer>
        )
    )

    return (
        <div
            ref={ref}
            className={cx(
                "income-distribution",
                "income-distribution-tutorial",
                {
                    "income-distribution--narrow": isNarrow,
                    "income-distribution-tutorial--with-rail": hasRail,
                    "income-distribution-tutorial--playing": !!walkthrough,
                }
            )}
        >
            {hasRail ? (
                <>
                    {!shouldHideControls && (
                        // Kept in place while a walkthrough plays, so the
                        // chart doesn't jump up
                        <div
                            className="income-distribution-tutorial__controls"
                            inert={!!walkthrough}
                        >
                            <IncomeDistributionControls {...controlsProps} />
                        </div>
                    )}
                    <WalkthroughRail
                        walkthroughs={WALKTHROUGHS}
                        progress={progress}
                        yearData={yearData}
                        onToggle={toggle}
                    />
                </>
            ) : (
                <WalkthroughPills
                    walkthroughs={WALKTHROUGHS}
                    progress={progress}
                    // Tapping the playing one leaves it playing: the "Exit
                    // tutorial" button in front of the pills is the way out
                    onSelect={open}
                    leading={leadingButton}
                />
            )}
            <div
                ref={chartRef}
                className="income-distribution-tutorial__chart"
                {...swipeHandlers}
            >
                {walkthrough && slide ? (
                    <SlideFrame
                        walkthrough={walkthrough}
                        slide={slide}
                        slideNumber={slideNumber}
                        metadata={metadata}
                        yearData={yearData}
                        chartState={chartState}
                        setters={slideSetters}
                        controlsProps={slideControlsProps}
                        isLoading={state.isLoading}
                        isNarrow={isNarrow}
                        onPrevious={previous}
                        onNext={next}
                        onClose={close}
                    />
                ) : (
                    <IncomeDistributionFrame
                        metadata={metadata}
                        yearData={yearData}
                        chartState={readerState}
                        onSetPovertyLine={setters.setPovertyLine}
                        onSelectedCountriesChange={setters.setSelectedCountries}
                        canClearPovertyLine={!shouldHideControls}
                        editCountries={shouldHideControls ? "hidden" : "auto"}
                        isLoading={state.isLoading}
                        isNarrow={isNarrow}
                        header={
                            <ChartHeader
                                title={
                                    config.title ??
                                    chartTitle(
                                        readerState.view,
                                        readerState.selectedCountries
                                    )
                                }
                                subtitle={
                                    config.subtitle ??
                                    chartSubtitle(
                                        yearData.year,
                                        readerState.currency
                                    )
                                }
                            />
                        }
                    />
                )}
            </div>
        </div>
    )
}

/** The chart frame while a slide is showing */
function SlideFrame({
    walkthrough,
    slide,
    slideNumber,
    metadata,
    yearData,
    chartState,
    setters,
    controlsProps,
    isLoading,
    isNarrow,
    onPrevious,
    onNext,
    onClose,
}: {
    walkthrough: Walkthrough
    slide: WalkthroughSlide
    slideNumber: number
    metadata: NonNullable<IncomeDistributionState["metadata"]>
    yearData: IncomeDistributionYear
    chartState: ChartState
    setters: ChartStateSetters
    controlsProps: IncomeDistributionControlsProps
    isLoading: boolean
    isNarrow: boolean
    onPrevious: () => void
    onNext: () => void
    onClose: () => void
}): React.ReactElement {
    // Names in the text take the colour of their curve or band
    const entityColors = useMemo(
        (): ReadonlyMap<string, string> =>
            chartState.view === "countries"
                ? assignCountryColors(chartState.selectedCountries)
                : new Map(Object.entries(REGION_COLORS)),
        [chartState.view, chartState.selectedCountries]
    )

    const aside = slide.aside
        ? resolveSlideText(slide.aside, yearData)
        : undefined

    // Narrow charts have no room for text over the plot: annotations join
    // the aside under the header, and hints are left out
    const annotations = useMemo(
        (): ChartAnnotation[] =>
            (slide.annotations ?? []).map(({ text, ...placement }, i) => ({
                ...placement,
                key: String(i),
                content: (
                    <RichText
                        text={resolveSlideText(text, yearData)}
                        entityColors={entityColors}
                    />
                ),
            })),
        [slide.annotations, yearData, entityColors]
    )

    const availableCountries = useMemo(
        () => yearData.countries.map((country) => country.name),
        [yearData]
    )
    const controlFor = (someSlide: WalkthroughSlide): React.ReactNode => {
        if (someSlide.control === "measuredIn")
            return <MeasuredInControl {...controlsProps} hideLabel />
        if (someSlide.control === "view")
            return <ViewControl {...controlsProps} hideLabel={isNarrow} />
        // Narrow charts have no legend to put the link in
        if (someSlide.control === "editCountries" && isNarrow)
            return (
                <CountryMultiSelect
                    availableCountries={availableCountries}
                    selectedCountries={chartState.selectedCountries}
                    onChange={setters.setSelectedCountries}
                    welfareTypeOf={placeholderWelfareType}
                    isNarrow
                />
            )
        return undefined
    }
    const control = controlFor(slide)

    // Every slide's header, so the header keeps the height of the tallest
    const headerPages = WALKTHROUGHS.flatMap((someWalkthrough) =>
        someWalkthrough.slides.map((someSlide, i): SlideHeaderPage => ({
            key: `${someWalkthrough.id}:${i + 1}`,
            walkthroughTitle: someWalkthrough.title,
            text: resolveSlideText(someSlide.text, yearData),
            secondLine: someSlide.secondLine
                ? resolveSlideText(someSlide.secondLine, yearData)
                : undefined,
            aside: isNarrow ? narrowAside(someSlide, yearData) : undefined,
            controls: isNarrow ? controlFor(someSlide) : undefined,
        }))
    )

    const navProps = {
        slide: slideNumber,
        slideCount: walkthrough.slides.length,
        onPrevious,
        onNext,
        onClose,
    }

    return (
        <IncomeDistributionFrame
            className="income-distribution-tutorial-frame"
            metadata={metadata}
            yearData={yearData}
            chartState={chartState}
            onSetPovertyLine={setters.setPovertyLine}
            onSelectedCountriesChange={setters.setSelectedCountries}
            canClearPovertyLine={false}
            // Narrow charts have the link over the plot instead
            editCountries={
                slide.control === "editCountries" && !isNarrow
                    ? "legend"
                    : "hidden"
            }
            // Narrow charts show no legend on the slides: it would sit above
            // the plot and push it down
            legend={isNarrow ? "hidden" : slide.legend}
            isLoading={isLoading}
            isNarrow={isNarrow}
            emphasis={{
                ...slide.emphasis,
                // Without the legend, narrow charts name the curves
                ...(isNarrow && slide.legend === "swatches"
                    ? { showSeriesLabels: true }
                    : {}),
                annotations: isNarrow ? undefined : annotations,
                isInteractive: false,
            }}
            header={
                <SlideHeader
                    pages={headerPages}
                    currentKey={`${walkthrough.id}:${slideNumber}`}
                    entityColors={entityColors}
                    closeLabel={`Close “${walkthrough.title}”`}
                    onClose={onClose}
                />
            }
            // Narrow charts keep the aside and the control in the header
            plotOverlay={
                !isNarrow && (aside || control) ? (
                    <div className="income-distribution-tutorial-aside">
                        {aside && (
                            <p className="income-distribution-tutorial-aside__text">
                                <RichText
                                    text={aside}
                                    entityColors={entityColors}
                                />
                            </p>
                        )}
                        {control}
                    </div>
                ) : undefined
            }
            chartAreaOverlay={
                isNarrow ? <SlideSideNav {...navProps} /> : undefined
            }
            footer={<SlideFooter {...navProps} isNarrow={isNarrow} />}
        />
    )
}

/**
 * Narrow charts: what goes under a slide's header in place of the text over
 * the plot, its aside and its annotations; hints are left out
 */
function narrowAside(
    slide: WalkthroughSlide,
    data: IncomeDistributionYear
): string | undefined {
    const texts = [
        slide.aside,
        ...(slide.annotations ?? [])
            .filter((annotation) => !annotation.isHint)
            .map((annotation) => annotation.text),
    ]
        .filter(R.isDefined)
        .map((text) => resolveSlideText(text, data))
    return texts.length > 0 ? texts.join(" ") : undefined
}

/**
 * Scrolls so the element is fully on screen, if it isn't: the least that
 * does it, or to its top when it's taller than the viewport
 */
function scrollIntoViewIfCutOff(element: HTMLElement): void {
    const { top, bottom, height } = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    if (top >= 0 && bottom <= viewportHeight) return
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches
    element.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: height > viewportHeight ? "start" : "nearest",
    })
}

/** Whether a key press belongs to something else: a text field, a slider or a popover */
function isOwnedByControl(event: KeyboardEvent): boolean {
    // Inside the shadow root, the event's target is retargeted to the host
    const target = event.composedPath()[0]
    if (!(target instanceof HTMLElement || target instanceof SVGElement))
        return false
    return !!target.closest(
        "input, textarea, select, [contenteditable], [role=slider], [role=listbox], [role=dialog]"
    )
}

/** ← and → change slides while a walkthrough is open, Escape closes it */
function useWalkthroughKeyboard({
    isOpen,
    onPrevious,
    onNext,
    onClose,
}: {
    isOpen: boolean
    onPrevious: () => void
    onNext: () => void
    onClose: () => void
}): void {
    useEffect(() => {
        if (!isOpen) return
        // Classified on the way down, before React handles the key: by the
        // time it bubbles up, closing a popover has taken its elements out
        // of the document
        const ownedByControl = new WeakSet<KeyboardEvent>()
        const handleCapture = (event: KeyboardEvent): void => {
            if (isOwnedByControl(event)) ownedByControl.add(event)
        }
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.altKey || event.ctrlKey || event.metaKey) return
            if (event.defaultPrevented || ownedByControl.has(event)) return
            if (event.key === "ArrowLeft") onPrevious()
            else if (event.key === "ArrowRight") onNext()
            else if (event.key === "Escape") onClose()
            else return
            event.preventDefault()
        }
        window.addEventListener("keydown", handleCapture, true)
        window.addEventListener("keydown", handleKeyDown)
        return () => {
            window.removeEventListener("keydown", handleCapture, true)
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen, onPrevious, onNext, onClose])
}

/** A horizontal swipe over the chart changes slides; dragging the poverty line doesn't */
function useSwipe({
    isEnabled,
    onPrevious,
    onNext,
}: {
    isEnabled: boolean
    onPrevious: () => void
    onNext: () => void
}): Pick<React.HTMLAttributes<HTMLElement>, "onTouchStart" | "onTouchEnd"> {
    const startRef = useRef<{ x: number; y: number } | null>(null)
    if (!isEnabled) return {}
    return {
        onTouchStart: (event) => {
            const touch = event.touches[0]
            const target = event.target
            const isOnLine =
                target instanceof Element &&
                !!target.closest(".income-distribution-chart__poverty-line")
            startRef.current =
                touch && !isOnLine
                    ? { x: touch.clientX, y: touch.clientY }
                    : null
        },
        onTouchEnd: (event) => {
            const start = startRef.current
            startRef.current = null
            const touch = event.changedTouches[0]
            if (!start || !touch) return
            const dx = touch.clientX - start.x
            const dy = touch.clientY - start.y
            if (
                Math.abs(dx) < SWIPE_DISTANCE ||
                Math.abs(dx) < 1.5 * Math.abs(dy)
            )
                return
            if (dx < 0) onNext()
            else onPrevious()
        },
    }
}
