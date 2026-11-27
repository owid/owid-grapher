import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import type { BespokeVariantProps } from "owid-bespoke-types"

import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"

import type { IncomeDistributionConfig } from "../index.js"
import { queryClient, type IncomeDistributionMetadata } from "../core/data.js"
import { chartSubtitle, chartTitle } from "../core/chartText.js"
import {
    useIncomeDistributionState,
    type IncomeDistributionState,
} from "../core/useIncomeDistributionState.js"
import type { IncomeDistributionYear } from "../core/types.js"
import {
    IncomeDistributionControls,
    type IncomeDistributionControlsProps,
} from "./IncomeDistributionControls.js"
import { ConfigureDrawer } from "./ConfigureDrawer.js"
import { IncomeDistributionFrame } from "./IncomeDistributionFrame.js"

/** What a variant's visual composition gets once the data is in */
export interface CaptionedVariantProps {
    config: IncomeDistributionConfig
    state: IncomeDistributionState
    metadata: IncomeDistributionMetadata
    yearData: IncomeDistributionYear
}

type FetchingVariantProps = BespokeVariantProps<IncomeDistributionConfig> & {
    /** The variant's visual composition, rendered once the metadata and the year's data are in */
    captioned: React.ComponentType<CaptionedVariantProps>
}

/**
 * The outer layers every variant shares: the providers, then the state hook
 * behind its skeleton and error gates
 */
export function FetchingIncomeDistributionVariant(
    props: FetchingVariantProps
): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <FetchingGate {...props} />
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function FetchingGate({
    config,
    urls,
    captioned: Captioned,
}: FetchingVariantProps): React.ReactElement {
    const state = useIncomeDistributionState(config, urls)

    if (state.status === "pending")
        return <ChartSkeleton className="income-distribution-chart-box" />
    if (state.status === "error" || !state.metadata || !state.yearData)
        return <ChartError className="income-distribution-chart-box" />

    return (
        <Captioned
            config={config}
            state={state}
            metadata={state.metadata}
            yearData={state.yearData}
        />
    )
}

/**
 * Whether the config hides the controls: asked to, or by giving the chart a
 * fixed title or subtitle, which the controls would contradict
 */
export function hidesControls(config: IncomeDistributionConfig): boolean {
    return config.hideControls || !!config.title || !!config.subtitle
}

/**
 * The controls as a card above the chart, or, on narrow charts, behind a
 * "Configure the data" button that opens them in a sheet mounted at
 * `container` (inside the shadow root, so the styles reach it)
 */
export function VariantControls({
    layout,
    container,
    controlsProps,
}: {
    layout: "card" | "drawer"
    container: HTMLElement | null
    controlsProps: IncomeDistributionControlsProps
}): React.ReactElement {
    if (layout === "drawer")
        return (
            <ConfigureDrawer container={container}>
                <IncomeDistributionControls
                    {...controlsProps}
                    layout="drawer"
                />
            </ConfigureDrawer>
        )
    return <IncomeDistributionControls {...controlsProps} />
}

/**
 * The chart as the reader set it up, under the title and subtitle generated
 * from that (or the config's fixed ones). The distribution variant is this;
 * the tutorial variant shows it between walkthroughs.
 */
export function ReaderFrame({
    config,
    state,
    metadata,
    yearData,
    isNarrow,
}: CaptionedVariantProps & { isNarrow: boolean }): React.ReactElement {
    const { chartState, setters } = state
    const hideControls = hidesControls(config)
    return (
        <IncomeDistributionFrame
            metadata={metadata}
            yearData={yearData}
            chartState={chartState}
            onSetPovertyLine={setters.setPovertyLine}
            onSelectedCountriesChange={setters.setSelectedCountries}
            canClearPovertyLine={!hideControls}
            editCountries={hideControls ? "hidden" : "auto"}
            isLoading={state.isLoading}
            isNarrow={isNarrow}
            header={
                <ChartHeader
                    title={
                        config.title ??
                        chartTitle(
                            chartState.view,
                            chartState.selectedCountries
                        )
                    }
                    subtitle={
                        config.subtitle ??
                        chartSubtitle(yearData.year, chartState.currency)
                    }
                />
            }
        />
    )
}
