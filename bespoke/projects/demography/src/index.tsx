import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { SimulationVariant } from "./variants/SimulationVariant.js"
import { PopulationVariant } from "./variants/PopulationVariant.js"
import { PopulationPyramidVariant } from "./variants/PopulationPyramidVariant.js"
import { ParametersVariant } from "./variants/ParametersVariant.js"
import { parseConfig, VariantName } from "./config.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

// export const VARIANTS = [
//     {
//         name: "simulation",
//         component: SimulationVariant,
//         demoConfig: {},
//         demoSize: "widest",
//     },
//     {
//         name: "population",
//         component: PopulationVariant,
//         demoConfig: {},
//         demoSize: "wide",
//     },
//     {
//         name: "populationPyramid",
//         component: PopulationPyramidVariant,
//         demoConfig: {},
//         demoSize: "narrow",
//     },
//     {
//         name: "parameters",
//         component: ParametersVariant,
//         demoConfig: {},
//         demoSize: "narrow",
//     },
// ] satisfies BespokeComponentVariantsList<VariantName>

export const VARIANTS = [
    {
        name: "simulation",
        component: SimulationVariant,
        demoConfig: {
            region: "South Korea",
            focusParameter: "lifeExpectancy",
            stabilizingParameter: "lifeExpectancy",
            populationPyramidUnit: "absolute",
        },
        demoSize: "widest",
    },
    {
        name: "population",
        component: PopulationVariant,
        demoConfig: {
            region: "South Korea",
            hideControls: "true",
        },
        demoSize: "wide",
    },
    {
        name: "parameters",
        component: ParametersVariant,
        demoConfig: {
            region: "South Korea",
            hideControls: "true",
        },
        demoSize: "narrow",
    },
    {
        name: "simulation",
        component: SimulationVariant,
        demoConfig: {
            region: "South Korea",
            hideControls: "true",
            hidePopulationPyramid: "true",
            focusParameter: "fertilityRate",
            stabilizingParameter: "fertilityRate",
        },
        demoSize: "widest",
    },
    {
        name: "simulation",
        component: SimulationVariant,
        demoConfig: {
            region: "South Korea",
            hideControls: "true",
            hidePopulationPyramid: "true",
            focusParameter: "lifeExpectancy",
            stabilizingParameter: "lifeExpectancy",
        },
        demoSize: "widest",
    },
    // {
    //     name: "populationPyramid",
    //     component: PopulationPyramidVariant,
    //     demoConfig: {
    //         region: "South Korea",
    //         hideControls: "true",
    //     },
    //     demoSize: "narrow",
    // },
    {
        name: "populationPyramid",
        component: PopulationPyramidVariant,
        demoConfig: {
            region: "South Korea",
            hideControls: "true",
            stabilizingParameter: "lifeExpectancy",
            showAssumptionCharts: "true",
        },
        demoSize: "narrow",
    },
    {
        name: "simulation",
        component: SimulationVariant,
        demoConfig: {
            region: "South Korea",
            hideControls: "true",
            hidePopulationPyramid: "true",
            focusParameter: "netMigrationRate",
            stabilizingParameter: "netMigrationRate",
        },
        demoSize: "widest",
    },
    {
        name: "simulation",
        component: SimulationVariant,
        demoConfig: {
            region: "South Korea",
        },
        demoSize: "widest",
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
    root.render(
        <>
            <StylesTarget />
            <variant.component config={config} />
        </>
    )
    return () => root.unmount()
}
