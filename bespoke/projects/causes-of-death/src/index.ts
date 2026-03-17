import { createRoot } from "react-dom/client"
import { createElement } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { enableShadowDOM } from "@react-stately/flags"
import { UNSAFE_PortalProvider } from "react-aria"

import type {
    BespokeComponentMountFn,
    BespokeComponentVariantsList,
} from "owid-bespoke-types"

import { CausesOfDeathChart } from "./components/CausesOfDeathChart.js"
import { CausesOfDeathPortalContext } from "./components/CausesOfDeathPortalContext.js"

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
            staleTime: Infinity,
        },
    },
})

function CausesOfDeathApp({ container }: { container: HTMLElement }) {
    // UNSAFE_PortalProvider tells all react-aria overlays (Popover,
    // Menu, Tooltip, etc.) to portal inside the Shadow DOM container
    // instead of document.body, so events and styles work correctly.
    return createElement(
        UNSAFE_PortalProvider,
        { getContainer: () => container },
        createElement(
            CausesOfDeathPortalContext.Provider,
            { value: container },
            createElement(
                QueryClientProvider,
                { client: queryClient },
                createElement(CausesOfDeathChart)
            )
        )
    )
}

export const VARIANTS = [
    { name: "treemap", component: CausesOfDeathApp, defaultConfig: {} },
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
    root.render(createElement(variant.component, { container }))
    return () => root.unmount()
}
