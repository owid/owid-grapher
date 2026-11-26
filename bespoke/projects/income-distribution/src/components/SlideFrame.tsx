import { useMemo } from "react"
import * as R from "remeda"

import { REGION_COLORS } from "../core/constants.js"
import { assignCountryColors } from "../core/chartModel.js"
import type { IncomeDistributionMetadata } from "../core/data.js"
import type {
    ChartState,
    ChartStateSetters,
} from "../core/useIncomeDistributionState.js"
import {
    resolveSlideText,
    WALKTHROUGHS,
    type Walkthrough,
    type WalkthroughSlide,
} from "../core/walkthroughs.js"
import type { IncomeDistributionYear } from "../core/types.js"
import type { ChartAnnotation } from "../core/presentation.js"
import { welfareTypeLookup } from "../core/welfareType.js"
import {
    MeasuredInControl,
    ViewControl,
    type IncomeDistributionControlsProps,
} from "./IncomeDistributionControls.js"
import { IncomeDistributionFrame } from "./IncomeDistributionFrame.js"
import { RichText } from "./RichText.js"
import {
    SlideFooter,
    SlideHeader,
    SlideSideNav,
    type SlideHeaderPage,
} from "./Walkthrough.js"
import { CountryMultiSelect } from "./CountryMultiSelect.js"

/** The chart frame while a slide is showing */
export function SlideFrame({
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
    isNudging,
    onPrevious,
    onNext,
    onClose,
}: {
    walkthrough: Walkthrough
    slide: WalkthroughSlide
    slideNumber: number
    metadata: IncomeDistributionMetadata
    yearData: IncomeDistributionYear
    chartState: ChartState
    setters: ChartStateSetters
    controlsProps: IncomeDistributionControlsProps
    isLoading: boolean
    isNarrow: boolean
    isNudging: boolean
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

    const controlFor = (someSlide: WalkthroughSlide): React.ReactNode => {
        if (someSlide.control === "measuredIn")
            return <MeasuredInControl {...controlsProps} hideLabel />
        if (someSlide.control === "view")
            return <ViewControl {...controlsProps} hideLabel={isNarrow} />
        // Narrow charts have no legend to put the link in
        if (someSlide.control === "editCountries" && isNarrow)
            return (
                <CountryMultiSelect
                    availableCountries={yearData.selectableNames}
                    selectedCountries={chartState.selectedCountries}
                    onChange={setters.setSelectedCountries}
                    welfareTypeOf={welfareTypeLookup(yearData)}
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
        isNudging,
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
            presentation={{
                ...slide.emphasis,
                // Without the legend, narrow charts name the curves
                ...(isNarrow && slide.legend === "swatches"
                    ? { showSeriesLabels: true }
                    : {}),
                annotations: isNarrow ? undefined : annotations,
                isPovertyLineFixed: walkthrough.fixedPovertyLine,
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
 * the plot, its aside and its annotations
 */
function narrowAside(
    slide: WalkthroughSlide,
    data: IncomeDistributionYear
): string | undefined {
    const texts = [
        slide.aside,
        ...(slide.annotations ?? []).map((annotation) => annotation.text),
    ]
        .filter(R.isDefined)
        .map((text) => resolveSlideText(text, data))
    return texts.length > 0 ? texts.join(" ") : undefined
}
