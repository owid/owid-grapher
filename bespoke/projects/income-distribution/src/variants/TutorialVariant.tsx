import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { parseAsInteger, parseAsString } from "nuqs"
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { BespokeVariantProps } from "owid-bespoke-types"

import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"

import type { IncomeDistributionConfig } from "../index.js"
import { NARROW_BREAKPOINT } from "../core/constants.js"
import type {
    ChartState,
    ChartStateSetters,
} from "../core/useIncomeDistributionState.js"
import {
    clampSlide,
    findWalkthrough,
    resolveSlideChartState,
    WALKTHROUGHS,
    type SlideChartField,
} from "../core/walkthroughs.js"
import { useIncomeDistributionControlsProps } from "../components/IncomeDistributionControls.js"
import {
    FetchingIncomeDistributionVariant,
    hidesControls,
    ReaderFrame,
    VariantControls,
    type CaptionedVariantProps,
} from "../components/VariantScaffold.js"
import {
    WalkthroughPills,
    WalkthroughRail,
    type WalkthroughProgress,
} from "../components/WalkthroughRail.js"
import { SlideFrame } from "../components/SlideFrame.js"
import {
    scrollIntoViewIfCutOff,
    useIdleNudge,
    useSwipe,
    useWalkthroughKeyboard,
} from "../components/walkthroughInteractions.js"

/** From this container width on, the walkthroughs sit in a rail left of the chart */
const RAIL_BREAKPOINT = 900
/** The rail's width and the gap after it (TutorialVariant.scss) */
const RAIL_WIDTH = 193
const RAIL_GAP = 32
/** Slide fields the reader's choice outlives the slide for (see stickyReleased) */
const STICKY_FIELDS: ReadonlySet<SlideChartField> = new Set([
    "currency",
    "timeInterval",
])

export function TutorialVariant(
    props: BespokeVariantProps<IncomeDistributionConfig>
): React.ReactElement {
    return (
        <FetchingIncomeDistributionVariant
            {...props}
            captioned={CaptionedTutorialVariant}
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

function CaptionedTutorialVariant(
    props: CaptionedVariantProps
): React.ReactElement {
    const { config, state, metadata, yearData } = props
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
    // Units the reader picked on a slide stay picked: on the slides after it
    // and on the chart once the walkthrough closes, so a reader who switched
    // to their own currency keeps seeing it
    const [stickyReleased, setStickyReleased] = useState<
        ReadonlySet<SlideChartField>
    >(() => new Set())
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
    const isNudging = useIdleNudge({
        isEnabled: !!walkthrough,
        node,
        // A new slide starts the wait over
        resetKey: `${walkthrough?.id}:${slideNumber}`,
    })

    // The slide's state over the reader's own; a line dragged on the slide
    // stays on the slide
    const chartState = useMemo((): ChartState => {
        if (!slide) return readerState
        const resolved = resolveSlideChartState(
            readerState,
            slide.chart,
            walkthrough?.fixedUnits
                ? slideState.released
                : new Set([...stickyReleased, ...slideState.released]),
            (name) => yearData.byName.has(name)
        )
        return slideState.povertyLine !== undefined
            ? { ...resolved, povertyLine: slideState.povertyLine }
            : resolved
    }, [walkthrough, slide, readerState, slideState, stickyReleased, yearData])

    // A slide's control writes to the reader's state, and from then on the
    // slide shows what the reader picked
    const release = useCallback(
        (field: SlideChartField) => {
            if (STICKY_FIELDS.has(field))
                setStickyReleased((current) => new Set([...current, field]))
            else
                updateSlideState((current) => ({
                    released: new Set([...current.released, field]),
                }))
        },
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

    const hideControls = hidesControls(config)
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
        !hideControls && (
            <VariantControls
                layout="drawer"
                container={node}
                controlsProps={controlsProps}
            />
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
                    {!hideControls && (
                        // Kept in place while a walkthrough plays, so the
                        // chart doesn't jump up
                        <div
                            className="income-distribution-tutorial__controls"
                            inert={!!walkthrough}
                        >
                            <VariantControls
                                layout="card"
                                container={node}
                                controlsProps={controlsProps}
                            />
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
                        isNudging={isNudging}
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
                    <ReaderFrame {...props} isNarrow={isNarrow} />
                )}
            </div>
        </div>
    )
}
