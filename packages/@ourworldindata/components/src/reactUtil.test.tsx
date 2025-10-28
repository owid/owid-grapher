/**
 * @vitest-environment happy-dom
 */

import { expect, describe, it } from "vitest"
import { reactRenderToStringClientOnly } from "./reactUtil.js"
import ReactDOMServer from "react-dom/server"

describe(reactRenderToStringClientOnly, () => {
    it("renders a React element to a string", () => {
        const element = <div>Hello, World!</div>
        const renderedString = reactRenderToStringClientOnly(element)
        expect(renderedString).toBe("<div>Hello, World!</div>")
    })

    it("output equals server-side rendering", () => {
        const element = (
            <div data-test={true}>
                <span>Test</span>
            </div>
        )
        const renderedString = reactRenderToStringClientOnly(element)
        const reactDomRenderedString = ReactDOMServer.renderToString(element)
        expect(renderedString).toBe(reactDomRenderedString)
    })
})
