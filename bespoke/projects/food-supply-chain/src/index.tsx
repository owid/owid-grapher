import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import { VariantName } from "./core/types.js"
import { WaterfallVariant } from "./variants/WaterfallVariant.js"

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

// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "waterfall",
        description:
            "Waterfall of how much food a country produces and where it goes",
        component: WaterfallVariant,
        demoEmbedOptions: { urlSync: true },
        defaultSize: "widest",
    },
] satisfies BespokeComponentVariantsList<VariantName>

export const CONFIG_SPEC = {
    title: {
        type: "string",
        description: "Chart title, replacing the generated one",
    },
    subtitle: {
        type: "string",
        description: "Chart subtitle, replacing the generated one",
    },
    country: {
        type: "string",
        description:
            "Country or region shown first, World if unset. `userLocation` picks the reader's country",
    },
    hideControls: {
        type: "boolean",
        description: "Hide the country, measure and year controls",
    },
} as const satisfies BespokeConfigSpec

export type FoodSupplyChainConfig = ConfigFromSpec<typeof CONFIG_SPEC>

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

    const config = parseConfigFromSpec(CONFIG_SPEC, opts.config ?? {})

    const root = createRoot(container)
    root.render(
        <>
            <StylesTarget />
            <EmbedOptionsProvider options={opts.embedOptions}>
                <variant.component config={config} urls={urls} />
            </EmbedOptionsProvider>
        </>
    )
    return () => root.unmount()
}
