import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { MigrantDemographicsChartWithProviders } from "./components/MigrantDemographicsChart.js"
import { MetricMode, MigrantDemographicsConfig } from "./helpers/constants.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "pyramid",
        component: MigrantDemographicsChartWithProviders,
        demoConfig: {},
        demoSize: "wide",
    },
] satisfies BespokeComponentVariantsList

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
    const config: MigrantDemographicsConfig = {
        entity: rawConfig.entity,
        year: rawConfig.year ? parseInt(rawConfig.year, 10) : undefined,
        metric: parseMetric(rawConfig.metric),
        compare: rawConfig.compare === "true",
        hideControls: rawConfig.hideControls === "true",
        urlSync: rawConfig.urlSync === "true",
    }

    const root = createRoot(container)
    root.render(
        <>
            <StylesTarget />
            <variant.component container={container} config={config} />
        </>
    )
    return () => root.unmount()
}

function parseMetric(value: string | undefined): MetricMode | undefined {
    return value === "number" || value === "share" ? value : undefined
}
