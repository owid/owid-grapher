import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"

import { CausesOfDeathChartWithProviders } from "./components/CausesOfDeathChart.js"
import {
    AGE_GROUPS,
    DEFAULT_REGION,
    SEXES,
} from "./core/CausesOfDeathConstants.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "treemap",
        description: "Treemap of deaths by cause in one country or region",
        component: CausesOfDeathChartWithProviders,
    },
] satisfies BespokeComponentVariantsList

export const CONFIG_SPEC = {
    region: {
        type: "string",
        default: DEFAULT_REGION,
        description:
            "Country or region shown first, such as `Nigeria` or `High-income countries`, or World if the data doesn't have it",
    },
    year: {
        type: "integer",
        description:
            "Year shown first. Defaults to the latest year in the data",
    },
    ageGroup: {
        type: "enum",
        values: AGE_GROUPS,
        default: "All ages",
        description: "Age group shown first",
    },
    sex: {
        type: "enum",
        values: SEXES,
        default: "Both sexes",
        description: "Sex shown first",
    },
    hideControls: {
        type: "boolean",
        description: "Hide the region, age group, sex and year controls",
    },
} as const satisfies BespokeConfigSpec

export type CausesOfDeathConfig = ConfigFromSpec<typeof CONFIG_SPEC>

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: BespokeComponentMountOpts
) => {
    const variant = VARIANTS.find((v) => v.name === opts.variant)
    if (!variant) {
        container.textContent = `Unknown variant: "${opts.variant}"`
        return
    }

    if (!opts.dataUrl || !opts.metadataUrl) {
        container.textContent =
            "Missing data URLs: add an entry for this bundle to the bespoke component registry"
        return
    }

    const urls = { dataUrl: opts.dataUrl, metadataUrl: opts.metadataUrl }

    const authoredConfig = opts.config ?? {}
    const config = parseConfigFromSpec(CONFIG_SPEC, authoredConfig)

    const root = createRoot(container)
    root.render(
        <>
            <StylesTarget />
            <variant.component config={config} urls={urls} />
        </>
    )
    return () => root.unmount()
}
