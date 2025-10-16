import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"

export const reactRenderToStringClientOnly = (
    element: React.ReactElement
): string => {
    if (typeof document === "undefined") {
        throw new Error(
            "reactRenderToStringClientOnly can only be used in a browser environment"
        )
    }

    // This is the React-recommended way of rendering a component to HTML on the client-side, see https://react.dev/reference/react-dom/server/renderToString#removing-rendertostring-from-the-client-code
    const div = document.createElement("div")
    const root = createRoot(div)
    flushSync(() => root.render(element))
    const html = div.innerHTML
    root.unmount()
    return html
}
