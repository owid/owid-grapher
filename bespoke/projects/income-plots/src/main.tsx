import { createRoot } from "react-dom/client"
import { App } from "./components/App.tsx"

export const mount = (container: HTMLElement) => {
    createRoot(container).render(<App />)
}

export const mountIntoShadowDOM = (hostElement: HTMLElement) => {
    const shadowRoot = hostElement.attachShadow({ mode: "open" })

    // Inject styles via link element
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "http://localhost:5173/admin/styles.css"
    shadowRoot.appendChild(link)

    const link2 = document.createElement("link")
    link2.rel = "stylesheet"
    link2.href = "http://localhost:5173/admin/controls.scss"
    shadowRoot.appendChild(link2)

    // Create a container for React
    const container = document.createElement("div")
    shadowRoot.appendChild(container)

    createRoot(container).render(<App />)

    return shadowRoot
}

const container = document.getElementById("root")
if (container) mount(container)
