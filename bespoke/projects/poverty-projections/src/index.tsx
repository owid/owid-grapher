import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { PovertyProjectionsChartWithProviders } from "./components/PovertyProjectionsChart.js"
import {
    ALL_SCENARIOS,
    BASELINE_SCENARIO,
    POVERTY_LINES,
    PovertyProjectionsConfig,
    SCENARIOS,
    ScenarioSelection,
    VariantName,
} from "./helpers/PovertyProjectionsConstants.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "share",
        variant: "share" as VariantName,
        component: PovertyProjectionsChartWithProviders,
        demoConfig: {},
        demoSize: "wide" as const,
    },
    {
        name: "stacked-area",
        variant: "stacked-area" as VariantName,
        component: PovertyProjectionsChartWithProviders,
        demoConfig: {},
        demoSize: "wide" as const,
    },
] satisfies BespokeComponentVariantsList

const parseScenario = (value?: string): ScenarioSelection | undefined => {
    if (!value) return undefined
    const validScenarios: ScenarioSelection[] = [
        BASELINE_SCENARIO,
        ALL_SCENARIOS,
        ...SCENARIOS.map((scenario) => scenario.id),
    ]
    // Validated against the variant's available options in the chart
    return validScenarios.find((scenario) => scenario === value)
}

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    const rawConfig = opts.config ?? {}
    const parsedPovertyLine = rawConfig.povertyLine
        ? parseInt(rawConfig.povertyLine, 10)
        : undefined
    const config: PovertyProjectionsConfig = {
        povertyLine: POVERTY_LINES.some(
            (line) => line.cents === parsedPovertyLine
        )
            ? parsedPovertyLine
            : undefined,
        scenario: parseScenario(rawConfig.scenario),
        hideControls: rawConfig.hideControls === "true",
    }

    const root = createRoot(container)
    root.render(
        <>
            <StylesTarget />
            <variant.component
                container={container}
                variant={variant.variant}
                config={config}
            />
        </>
    )
    return () => root.unmount()
}
