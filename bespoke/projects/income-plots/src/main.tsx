import { createRoot } from "react-dom/client"
import { App } from "./components/App.tsx"
import { ShadowRootContext } from "./ShadowRootContext.tsx"

export const mount = (hostElement: HTMLElement) => {
    // Create a container for React
    const container = document.createElement("div")
    hostElement.appendChild(container)

    const root = createRoot(container)

    root.render(
        <ShadowRootContext.Provider value={hostElement}>
            <App />
        </ShadowRootContext.Provider>
    )

    return () => {
        root.unmount()
    }
}

const container = document.getElementById("root")
if (container) mount(container)
