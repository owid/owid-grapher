import { render } from "react-dom"
import { InstantSearchContainer } from "./SearchPanel.js"

export function runSearchPage() {
    render(<InstantSearchContainer />, document.querySelector("main"))
}
