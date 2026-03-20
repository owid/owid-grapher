import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"

import { SimulationVariantWithProviders } from "./variants/SimulationVariant.js"
import { PopulationVariantWithProviders } from "./variants/PopulationVariant.js"
import { PopulationPyramidVariantWithProviders } from "./variants/PopulationPyramidVariant.js"
import { ParametersVariantWithProviders } from "./variants/ParametersVariant.js"
import { parseConfig, VariantName } from "./config.js"

// Styles for portaled react-aria overlays that render outside the Shadow
// DOM (e.g. dropdown menus). On the real site these are available globally;
// importing them here ensures they're present on the demo page too.
import "./demo.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "simulation",
        component: SimulationVariantWithProviders,
        demoConfig: {},
    },
    {
        name: "population",
        component: PopulationVariantWithProviders,
        demoConfig: {},
    },
    {
        name: "populationPyramid",
        component: PopulationPyramidVariantWithProviders,
        demoConfig: {
            region: "South Korea",
            hideTimeline: "true",
            hideControls: "true",
        },
    },
    {
        name: "parameters",
        component: ParametersVariantWithProviders,
        demoConfig: {},
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    const config = parseConfig(variant.name, opts.config ?? {})

    const root = createRoot(container)
    root.render(createElement(variant.component, { container, config }))
    return () => root.unmount()
}
