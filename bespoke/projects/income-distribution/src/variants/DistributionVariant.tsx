import cx from "clsx"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import type {
    BespokeComponentDataUrls,
    BespokeVariantProps,
} from "owid-bespoke-types"

import type { IncomeDistributionConfig } from "../index.js"
import { NARROW_BREAKPOINT } from "../core/constants.js"
import { queryClient } from "../core/data.js"
import { chartSubtitle, chartTitle } from "../core/chartText.js"
import {
    useIncomeDistributionState,
    type IncomeDistributionState,
} from "../core/useIncomeDistributionState.js"
import {
    IncomeDistributionControls,
    useIncomeDistributionControlsProps,
} from "../components/IncomeDistributionControls.js"
import { ConfigureDrawer } from "../components/ConfigureDrawer.js"
import { IncomeDistributionFrame } from "../components/IncomeDistributionFrame.js"

export function DistributionVariant({
    config,
    urls,
}: BespokeVariantProps<IncomeDistributionConfig>): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <FetchingDistributionVariant config={config} urls={urls} />
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function FetchingDistributionVariant({
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
        <CaptionedDistributionVariant
            config={config}
            state={state}
            metadata={state.metadata}
            yearData={state.yearData}
        />
    )
}

function CaptionedDistributionVariant({
    config,
    state,
    metadata,
    yearData,
}: {
    config: IncomeDistributionConfig
    state: IncomeDistributionState
    metadata: NonNullable<IncomeDistributionState["metadata"]>
    yearData: NonNullable<IncomeDistributionState["yearData"]>
}): React.ReactElement {
    const { width, node, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < NARROW_BREAKPOINT
    const { chartState, setters } = state

    const controlsProps = useIncomeDistributionControlsProps({
        chartState,
        setters,
        currencies: state.currencies,
        suggestedCurrency: state.suggestedCurrency,
        isNarrow,
    })

    // A custom title or subtitle is fixed text, which the controls would contradict
    const shouldHideControls =
        config.hideControls || !!config.title || !!config.subtitle

    const title =
        config.title ??
        chartTitle(chartState.view, chartState.selectedCountries)
    const subtitle =
        config.subtitle ?? chartSubtitle(yearData.year, chartState.currency)

    return (
        <div
            ref={ref}
            className={cx("income-distribution", {
                "income-distribution--narrow": isNarrow,
            })}
        >
            {!shouldHideControls &&
                (isNarrow ? (
                    // Narrow charts keep the controls in a bottom sheet,
                    // behind a button
                    <ConfigureDrawer container={node}>
                        <IncomeDistributionControls
                            {...controlsProps}
                            layout="drawer"
                        />
                    </ConfigureDrawer>
                ) : (
                    <IncomeDistributionControls {...controlsProps} />
                ))}
            <IncomeDistributionFrame
                metadata={metadata}
                yearData={yearData}
                chartState={chartState}
                onSetPovertyLine={setters.setPovertyLine}
                onSelectedCountriesChange={setters.setSelectedCountries}
                canClearPovertyLine={!shouldHideControls}
                editCountries={shouldHideControls ? "hidden" : "auto"}
                isLoading={state.isLoading}
                isNarrow={isNarrow}
                header={<ChartHeader title={title} subtitle={subtitle} />}
            />
        </div>
    )
}
