import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import { WhereAreThePoorChartWithProviders } from "./components/WhereAreThePoorChart.js"
import {
    CONTINENT_OPTIONS,
    GROUP_BY_OPTIONS,
    POVERTY_LINES,
    WhereAreThePoorConfig,
} from "./helpers/PovertyConstants.js"

import "./index.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

export const VARIANTS = [
    {
        name: "treemap",
        component: WhereAreThePoorChartWithProviders,
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
    const parsedPovertyLine = rawConfig.povertyLine
        ? parseInt(rawConfig.povertyLine, 10)
        : undefined
    const config: WhereAreThePoorConfig = {
        povertyLine: POVERTY_LINES.some(
            (line) => line.cents === parsedPovertyLine
        )
            ? parsedPovertyLine
            : undefined,
        year: rawConfig.year ? parseInt(rawConfig.year, 10) : undefined,
        groupBy: GROUP_BY_OPTIONS.find(
            (option) => option.value === rawConfig.groupBy
        )?.value,
        continent: CONTINENT_OPTIONS.find(
            (continent) => continent === rawConfig.continent
        ),
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
