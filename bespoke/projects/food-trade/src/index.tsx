import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import { FLOWS, VariantName } from "./core/types.js"
import { SankeyVariant } from "./variants/SankeyVariant"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
    BespokeConfigSpec,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import {
    ConfigFromSpec,
    parseConfigFromSpec,
    parseEmbedConfig,
} from "../../../helpers/config.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "sankey",
        description:
            "Sankey of which countries trade one food product with each other",
        component: SankeyVariant,
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    hideControls: {
        type: "boolean",
        description:
            "Hide the heading and the product, country and flow controls",
    },
    hideHeading: {
        type: "boolean",
        description: "Hide the heading above the controls",
    },
    hideFlowSwitcher: {
        type: "boolean",
        description: "Hide the switch between imports, exports and both",
    },
    title: {
        type: "string",
        description:
            "Chart title, replacing the generated one. Also hides the heading and controls",
    },
    subtitle: {
        type: "string",
        description:
            "Chart subtitle, replacing the generated one. Also hides the heading and controls",
    },
    product: {
        type: "string",
        default: "Maize",
        description: "Food product shown first",
    },
    country: {
        type: "string",
        default: "All countries",
        description:
            "Country shown first. `userLocation` picks the reader's country, or All countries if the data doesn't have it",
    },
    flow: {
        type: "enum",
        values: FLOWS,
        default: "both",
        description:
            "Trade direction shown first. Ignored when the country is All countries",
    },
} as const satisfies BespokeConfigSpec

export type FoodTradeConfig = ConfigFromSpec<typeof CONFIG_SPEC>

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
    const config = {
        ...parseConfigFromSpec(CONFIG_SPEC, authoredConfig),
        ...parseEmbedConfig(authoredConfig),
    }

    const root = createRoot(container)
    root.render(
        <>
            {/* This is where Vite-injected styles will be placed - make sure to add this to your code so that the styles are correctly injected into the Shadow DOM. */}
            <StylesTarget />
            <variant.component config={config} urls={urls} />
        </>
    )
    return () => root.unmount()
}
