import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import {
    DEFAULT_COUNTRY,
    DEFAULT_YEAR,
    PERIODS,
    VIEWS,
    VariantName,
} from "./core/types.js"
import { SankeyVariant } from "./variants/SankeyVariant"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { ConfigFromSpec, parseConfigFromSpec } from "../../../helpers/config.js"
import { EmbedOptionsProvider } from "../../../hooks/useEmbedOptions.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "sankey",
        description:
            "Sankey of where one country's deforestation-linked commodities were consumed, or where the commodities it consumed were produced",
        component: SankeyVariant,
        demoEmbedOptions: { urlSync: true },
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        description:
            "Chart title, replacing the generated one. Also hides the controls",
    },
    subtitle: {
        type: "string",
        description:
            "Chart subtitle, replacing the generated one. Also hides the controls",
    },
    country: {
        type: "string",
        default: DEFAULT_COUNTRY,
        description:
            "Country shown first. `userLocation` picks the reader's country",
    },
    year: {
        type: "integer",
        default: DEFAULT_YEAR,
        description:
            "Year shown first when the period is a single year. If it is unavailable, uses the latest year in the data",
    },
    period: {
        type: "enum",
        values: PERIODS,
        default: "single-year",
        description:
            "Time period shown first: one year, or the sum over the last 5 or 10 years of the data",
    },
    flow: {
        type: "enum",
        values: VIEWS,
        default: "production",
        description:
            "View shown first: where the country's production was consumed, or where its consumption was produced",
    },
    hideControls: {
        type: "boolean",
        description:
            "Hide the country, year, period and production/consumption controls",
    },
    hideFlowSwitcher: {
        type: "boolean",
        description: "Hide the switch between production and consumption",
    },
} as const satisfies BespokeConfigSpec

export type DeforestationConfig = ConfigFromSpec<typeof CONFIG_SPEC>

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
            {/* This is where Vite-injected styles will be placed - make sure to add this to your code so that the styles are correctly injected into the Shadow DOM. */}
            <StylesTarget />
            <EmbedOptionsProvider options={opts.embedOptions}>
                <variant.component config={config} urls={urls} />
            </EmbedOptionsProvider>
        </>
    )
    return () => root.unmount()
}
