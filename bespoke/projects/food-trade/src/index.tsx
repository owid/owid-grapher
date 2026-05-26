import { createRoot } from "react-dom/client"

import "./reactAriaShadowDomSetup"

import { VariantName } from "./constants.js"
import { parseConfig } from "./config.js"
import { MainVariant } from "./variants/MainVariant"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"
import StylesTarget from "vite-plugin-css-position/react"

import "./index.scss"

export const VARIANTS = [
    { name: "main", component: MainVariant, demoConfig: {} },
    {
        name: "main",
        component: MainVariant,
        demoConfig: { country: "United Kingdom" },
    },
    {
        name: "main",
        component: MainVariant,
        demoConfig: { country: "United Kingdom", tradeFlow: "imports" },
    },
    {
        name: "main",
        component: MainVariant,
        demoConfig: {
            country: "United Kingdom",
            tradeFlow: "imports",
            product: "Barley",
        },
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

    const config = parseConfig(opts.config ?? {})

    const root = createRoot(container)
    root.render(
        <>
            {/* This is where Vite-injected styles will be placed - make sure to add this to your code so that the styles are correctly injected into the Shadow DOM. */}
            <StylesTarget />
            <variant.component config={config} />
        </>
    )
    return () => root.unmount()
}
