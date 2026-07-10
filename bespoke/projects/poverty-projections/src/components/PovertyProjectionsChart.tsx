import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

import {
    BASELINE_SCENARIO,
    DEFAULT_POVERTY_LINE_CENTS,
    POVERTY_LINES,
    PovertyProjectionsConfig,
    ScenarioSelection,
    VariantName,
} from "../helpers/PovertyProjectionsConstants.js"
import { useProjectionsData } from "../helpers/PovertyProjectionsDataFetching.js"
import {
    getScenarioOptions,
    ProjectionsControls,
} from "./ProjectionsControls.js"
import { PovertyProjectionsCaptionedChart } from "./PovertyProjectionsCaptionedChart.js"
import { ProjectionsSpinner } from "./ProjectionsSpinner.js"

const queryClient = new QueryClient()

export function PovertyProjectionsChartWithProviders(props: {
    container?: HTMLDivElement
    variant: VariantName
    config?: PovertyProjectionsConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <PovertyProjectionsChart
                variant={props.variant}
                config={props.config}
            />
        </QueryClientProvider>
    )
}

function PovertyProjectionsChart({
    variant,
    config,
}: {
    variant: VariantName
    config?: PovertyProjectionsConfig
}): React.ReactElement {
    const [povertyLineCents, setPovertyLineCents] = useState(
        POVERTY_LINES.find((line) => line.cents === config?.povertyLine)
            ?.cents ?? DEFAULT_POVERTY_LINE_CENTS
    )
    const [scenario, setScenario] = useState<ScenarioSelection>(() => {
        // Only accept scenarios that exist for this variant (e.g. the
        // all-scenarios fan doesn't exist for the stacked chart)
        const configured = config?.scenario
        const isValid =
            configured !== undefined &&
            getScenarioOptions(variant).some(
                (option) => option.value === configured
            )
        return isValid ? configured : BASELINE_SCENARIO
    })

    const { data, status, isPlaceholderData } =
        useProjectionsData(povertyLineCents)

    // Only show loading overlays after a delay to prevent flashing
    const isLoadingData = useDelayedLoading(isPlaceholderData, 300)

    if (status === "error") return <PovertyProjectionsChartError />
    if (status === "pending") return <PovertyProjectionsSkeleton />
    if (!data) return <PovertyProjectionsChartError />

    return (
        <div className="poverty-projections-chart-root">
            {!config?.hideControls && (
                <ProjectionsControls
                    variant={variant}
                    povertyLineCents={povertyLineCents}
                    scenario={scenario}
                    setPovertyLineCents={setPovertyLineCents}
                    setScenario={setScenario}
                />
            )}
            <PovertyProjectionsCaptionedChart
                variant={variant}
                data={data}
                povertyLineCents={povertyLineCents}
                scenario={scenario}
                isLoading={isLoadingData}
            />
        </div>
    )
}

function PovertyProjectionsChartError() {
    return <div>The visualization can't be loaded</div>
}

function PovertyProjectionsSkeleton() {
    return (
        <div className="poverty-projections-skeleton">
            <ProjectionsSpinner />
        </div>
    )
}
