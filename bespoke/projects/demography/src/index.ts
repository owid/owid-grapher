import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { enableShadowDOM } from "@react-stately/flags"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"

import { DemographyChart } from "./components/DemographyChart.js"

// Styles for portaled react-aria overlays that render outside the Shadow
// DOM (e.g. dropdown menus). On the real site these are available globally;
// importing them here ensures they're present on the demo page too.
import "./demo.scss"

// Enable react-aria's internal Shadow DOM handling paths.
// Must be called before any react-aria components render.
enableShadowDOM()

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
        },
    },
})

function DemographyChartWithProviders({
    container: _container,
    config: _config,
}: {
    container: HTMLDivElement
    config?: Record<string, string>
}) {
    return createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(DemographyChart)
    )
}

export const VARIANTS = [
    {
        name: "simulator",
        component: DemographyChartWithProviders,
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

    const root = createRoot(container)
    root.render(
        createElement(variant.component, {
            container,
            config: opts.config,
        })
    )
    return () => root.unmount()
}
