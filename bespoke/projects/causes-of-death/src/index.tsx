import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { CausesOfDeathChartWithProviders } from "./components/CausesOfDeathChart.js"
import { CausesOfDeathConfig } from "./helpers/CausesOfDeathConstants.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "treemap",
        component: CausesOfDeathChartWithProviders,
        defaultConfig: {},
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
    const config: CausesOfDeathConfig = {
        region: rawConfig.region,
        sex: rawConfig.sex,
        ageGroup: rawConfig.ageGroup,
        year: rawConfig.year ? parseInt(rawConfig.year, 10) : undefined,
        hideControls: rawConfig.hideControls === "true",
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
