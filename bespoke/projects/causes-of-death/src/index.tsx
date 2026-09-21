import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { parseEmbedConfig } from "../../../helpers/config.js"

import { CausesOfDeathChartWithProviders } from "./components/CausesOfDeathChart.js"
import { parseConfig } from "./core/config.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "treemap",
        component: CausesOfDeathChartWithProviders,
    },
] satisfies BespokeComponentVariantsList

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

    const rawConfig = opts.config ?? {}
    const config = {
        ...parseConfig(rawConfig),
        ...parseEmbedConfig(rawConfig),
    }

    const root = createRoot(container)
    root.render(
        <>
            <StylesTarget />
            <variant.component config={config} urls={urls} />
        </>
    )
    return () => root.unmount()
}
