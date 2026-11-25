import { useRef } from "react"
import cx from "clsx"
import { faArrowRightFromBracket } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import type { BespokeVariantProps } from "owid-bespoke-types"

import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

import type { IncomeDistributionConfig } from "../index.js"
import { NARROW_BREAKPOINT } from "../core/constants.js"
import { WALKTHROUGHS } from "../core/walkthroughs.js"
import { useWalkthroughPlayback } from "../core/useWalkthroughPlayback.js"
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
} from "../components/WalkthroughRail.js"
import { SlideFrame } from "../components/SlideFrame.js"
import { useWalkthroughNavigation } from "../components/walkthroughInteractions.js"

/** From this container width on, the walkthroughs sit in a rail left of the chart */
const RAIL_BREAKPOINT = 900
/** The rail's width and the gap after it (TutorialVariant.scss) */
const RAIL_WIDTH = 193
const RAIL_GAP = 32

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

function CaptionedTutorialVariant(
    props: CaptionedVariantProps
): React.ReactElement {
    const { config, state, metadata, yearData } = props
    const { width, node, ref } = useContainerWidth()
    const hasRail = width >= RAIL_BREAKPOINT
    const columnWidth = hasRail ? width - RAIL_WIDTH - RAIL_GAP : width
    const isNarrow = width > 0 && columnWidth < NARROW_BREAKPOINT
    const { chartState: readerState, setters } = state

    const chartRef = useRef<HTMLDivElement>(null)
    const {
        walkthrough,
        slide,
        slideNumber,
        progress,
        open,
        close,
        toggle,
        previous,
        next,
        swipeHandlers,
        isNudging,
    } = useWalkthroughNavigation({
        defaultWalkthroughId: config.walkthrough ?? "",
        node,
        chartRef,
    })
    const { chartState, slideSetters } = useWalkthroughPlayback({
        readerState,
        setters,
        walkthrough,
        slide,
        slideNumber,
        yearData,
    })

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
