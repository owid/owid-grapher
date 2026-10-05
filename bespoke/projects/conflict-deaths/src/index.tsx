import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentMountOpts,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { parseEmbedConfig } from "../../../helpers/config.js"

import { ConflictDeathsChartWithProviders } from "./components/ConflictDeathsChart.js"
import { parseConfig } from "./core/config.js"
import { getSampleDataUrls, USE_SAMPLE_DATA } from "./core/sampleData.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "treemap",
        component: ConflictDeathsChartWithProviders,
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

    const urls = USE_SAMPLE_DATA
        ? getSampleDataUrls()
        : opts.dataUrl && opts.metadataUrl
          ? { dataUrl: opts.dataUrl, metadataUrl: opts.metadataUrl }
          : undefined

    if (!urls) {
        container.textContent =
            "Missing data URLs: add an entry for this bundle to the bespoke component registry"
        return
    }

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
