import { createRoot } from "react-dom/client"
import { App } from "./components/App.tsx"

const container = document.getElementById("root")
if (!container) {
    const rootDiv = document.createElement("div")
    rootDiv.id = "root"
    document.body.appendChild(rootDiv)
    createRoot(rootDiv).render(<App />)
} else {
    createRoot(container).render(<App />)
}
