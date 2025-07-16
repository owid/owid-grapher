import { createRoot } from "react-dom/client"
import { DEPRECATEDInstantSearchContainer } from "./_DEPRECATEDSearchPanel.js"

export function DEPRECATEDrunSearchPage() {
    const container = document.querySelector("main")
    if (!container) return

    const root = createRoot(container)
    root.render(<DEPRECATEDInstantSearchContainer />)
}
