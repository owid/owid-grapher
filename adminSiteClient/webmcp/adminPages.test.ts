import { describe, expect, it } from "vitest"
import { ADMIN_PAGES, resolveAdminPath } from "./adminPages.js"

describe(resolveAdminPath, () => {
    it("accepts a path, with or without the /admin prefix", () => {
        expect(resolveAdminPath("/data-insights")).toEqual({
            ok: true,
            path: "/data-insights",
            search: "",
        })
        expect(resolveAdminPath("/admin/data-insights")).toMatchObject({
            ok: true,
            path: "/data-insights",
        })
    })

    it("accepts a full URL, as pasted from the browser bar", () => {
        expect(
            resolveAdminPath(
                "http://staging-site-admin-webmcp/admin/multi-dims"
            )
        ).toMatchObject({ ok: true, path: "/multi-dims" })
    })

    it("accepts a page's name the way a person says it", () => {
        expect(resolveAdminPath("data insights")).toMatchObject({
            ok: true,
            path: "/data-insights",
        })
        expect(resolveAdminPath("Multi Dims")).toMatchObject({
            ok: true,
            path: "/multi-dims",
        })
    })

    it("keeps a query string, and a trailing slash makes no difference", () => {
        expect(resolveAdminPath("/charts?chartSearch=co2")).toEqual({
            ok: true,
            path: "/charts",
            search: "?chartSearch=co2",
        })
        expect(resolveAdminPath("/gdocs/")).toMatchObject({
            ok: true,
            path: "/gdocs",
        })
    })

    it("accepts detail pages, preserving case in ids", () => {
        expect(resolveAdminPath("/multi-dims/2713")).toMatchObject({
            ok: true,
            path: "/multi-dims/2713",
        })
        expect(resolveAdminPath("/gdocs/1NmWD77xNFIj/preview")).toMatchObject({
            ok: true,
            path: "/gdocs/1NmWD77xNFIj/preview",
        })
        expect(resolveAdminPath("/charts/317/edit")).toMatchObject({
            ok: true,
            path: "/charts/317/edit",
        })
    })

    it("refuses a page that does not exist, suggesting near misses", () => {
        const near = resolveAdminPath("/insights")
        expect(near.ok).toBe(false)
        if (!near.ok) expect(near.candidates).toContain("/data-insights")

        // Nothing close enough: the tool falls back to listing every page,
        // so an agent is never left without a next move.
        const far = resolveAdminPath("/data-insight-list")
        expect(far.ok).toBe(false)
    })

    it("refuses anything that is not an admin page at all", () => {
        expect(resolveAdminPath("https://evil.example/steal").ok).toBe(false)
        expect(resolveAdminPath("/charts/317/edit/../../etc").ok).toBe(false)
    })

    it("lists only admin-relative paths", () => {
        for (const page of ADMIN_PAGES) {
            expect(page.path.startsWith("/")).toBe(true)
            expect(page.path.startsWith("/admin")).toBe(false)
            expect(page.summary.length).toBeGreaterThan(2)
        }
        const paths = ADMIN_PAGES.map((p) => p.path)
        expect(new Set(paths).size).toBe(paths.length)
    })
})
