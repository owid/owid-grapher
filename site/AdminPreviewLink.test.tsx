import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AdminPreviewLink } from "./AdminPreviewLink.js"

describe(AdminPreviewLink, () => {
    // The public site is statically baked, so anything server-rendered here ends
    // up in the HTML every visitor downloads. The cookie this is gated on only
    // exists in the browser, so the link has to be drawn client-side or not at
    // all - baking it would show staff furniture to the world.
    it("renders nothing into the server HTML", () => {
        const html = renderToStaticMarkup(
            <AdminPreviewLink slug="life-expectancy" />
        )

        expect(html).toBe("")
    })

    it("renders nothing on a preview, which is where the link goes", () => {
        const html = renderToStaticMarkup(
            <AdminPreviewLink slug="life-expectancy" isPreviewing />
        )

        expect(html).toBe("")
    })

    it("renders nothing without a slug to point at", () => {
        expect(renderToStaticMarkup(<AdminPreviewLink slug={null} />)).toBe("")
        expect(renderToStaticMarkup(<AdminPreviewLink slug={undefined} />)).toBe(
            ""
        )
    })
})
