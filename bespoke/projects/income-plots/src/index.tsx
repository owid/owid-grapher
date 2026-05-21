import { createRoot } from "react-dom/client"
import { enableShadowDOM } from "@react-stately/flags"
import StylesTarget from "vite-plugin-css-position/react"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"

import { App } from "./components/App.tsx"
import { ShadowRootContext } from "./ShadowRootContext.tsx"
import "./main.scss"

type IncomePlotVariantName = "distribution" | "upside-down"

export const VARIANTS = [
    { name: "distribution", demoConfig: {} },
    { name: "distribution", demoConfig: { tab: "countries" } },
] satisfies BespokeComponentVariantsList<IncomePlotVariantName>

enableShadowDOM()

export const mount: BespokeComponentMountFn = (
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
) => {
    const variantName = opts.variant ?? "distribution"
    const variant = VARIANTS.find((entry) => entry.name === variantName)

    if (!variant) {
        container.textContent = `Unknown variant: "${variantName}"`
        return
    }

    const initialTab = opts.config?.tab as "global" | "countries" | undefined

    const root = createRoot(container)
    root.render(
        <ShadowRootContext.Provider value={container}>
            <StylesTarget />
            <App tab={initialTab} />
        </ShadowRootContext.Provider>
    )

    return () => {
        root.unmount()
    }
}
