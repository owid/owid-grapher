import { createRoot } from "react-dom/client"
import { App } from "./components/App.tsx"
import { ShadowRootContext } from "./ShadowRootContext.tsx"

export const mount = (
    hostElement: HTMLElement,
    opts?: { variant: string; config?: Record<string, unknown> }
) => {
    // Create a container for React
    const container = document.createElement("div")
    hostElement.appendChild(container)

    const root = createRoot(container)

    if (opts?.variant === "distribution") {
        root.render(
            <ShadowRootContext.Provider value={hostElement}>
                <App />
            </ShadowRootContext.Provider>
        )
    } else if (opts?.variant === "upside-down") {
        root.render(
            <div style={{ transform: "scaleY(-1)" }}>
                <ShadowRootContext.Provider value={hostElement}>
                    <App />
                </ShadowRootContext.Provider>
            </div>
        )
    }

    return () => {
        root.unmount()
    }
}

const container = document.getElementById("root")
if (container) mount(container, { variant: "distribution" })
