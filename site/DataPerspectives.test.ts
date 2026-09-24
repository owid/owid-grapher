import { expect, it, describe, vi } from "vitest"
import { parseDataPerspectivesVariant } from "./dataPerspectivesVariant.js"
import { DATA_PERSPECTIVES } from "./dataPerspectivesFixtures.js"

describe("data perspectives URL variants", () => {
    it("is off unless a layout is asked for", () => {
        expect(parseDataPerspectivesVariant("")).toEqual({
            layout: "off",
            style: "panel",
            narrativeStale: "hide",
            upNext: false,
            hintReset: false,
            ignored: [],
        })
    })

    it("reads the two layouts", () => {
        expect(parseDataPerspectivesVariant("?dpLayout=pageswipe").layout).toBe(
            "pageswipe"
        )
        expect(parseDataPerspectivesVariant("?dpLayout=accordion").layout).toBe(
            "accordion"
        )
    })

    it("reads every style and stale mode", () => {
        for (const style of ["panel", "card", "seamless", "narrative"]) {
            expect(
                parseDataPerspectivesVariant(`?dpStyle=${style}`).style
            ).toBe(style)
        }
        for (const mode of ["hide", "disable", "revert"]) {
            expect(
                parseDataPerspectivesVariant(`?dpNarrativeStale=${mode}`)
                    .narrativeStale
            ).toBe(mode)
        }
    })

    it("turns on the Up next carousel", () => {
        expect(parseDataPerspectivesVariant("?dpUpNext=1").upNext).toBe(true)
        expect(parseDataPerspectivesVariant("?dpUpNext=1").ignored).toEqual([])
    })

    it("is forgiving about case and singular/plural", () => {
        const v = parseDataPerspectivesVariant(
            "?DPLAYOUT=Pageswipe&dpstyle=NARRATIVES"
        )
        expect(v.layout).toBe("pageswipe")
        expect(v.style).toBe("narrative")
        expect(v.ignored).toEqual([])
    })

    it("reports what it couldn't use, rather than silently ignoring it", () => {
        const v = parseDataPerspectivesVariant(
            "?dpLayout=rail&dpDrawer=metadata&dpStyle=loud&country=~SWE"
        )
        expect(v.layout).toBe("off")
        expect(v.style).toBe("panel")
        expect(v.ignored).toEqual([
            "dpDrawer=metadata",
            "dpLayout=rail",
            "dpStyle=loud",
        ])
    })
})

describe("data perspective fixtures", () => {
    it("are just a title and a grapher query string", () => {
        for (const perspectives of Object.values(DATA_PERSPECTIVES)) {
            for (const p of perspectives) {
                expect(Object.keys(p).sort()).toEqual(["queryParams", "title"])
                expect(p.title.length).toBeGreaterThan(0)
                // A query string, not a URL: no leading "?" or host.
                expect(p.queryParams.startsWith("?")).toBe(false)
                expect(p.queryParams.includes("://")).toBe(false)
            }
        }
    })

    it("have distinct query strings (they key the dots and rows)", () => {
        for (const perspectives of Object.values(DATA_PERSPECTIVES)) {
            const params = perspectives.map((p) => p.queryParams)
            expect(new Set(params).size).toBe(params.length)
        }
    })
})

describe("swipe nudge memory", () => {
    // A minimal localStorage, since the test environment may not have one.
    const store = new Map<string, string>()
    const fakeStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
            store.set(k, v)
        },
        removeItem: (k: string) => {
            store.delete(k)
        },
    }
    const DAY = 24 * 60 * 60 * 1000

    it("shows once, then waits, then gives up — and never after a swipe", async () => {
        vi.stubGlobal("localStorage", fakeStorage)
        const m = await import("./swipeHintMemory.js")
        const now = Date.now()
        vi.spyOn(Date, "now").mockReturnValue(now)

        m.resetSwipeHintMemory()
        expect(m.shouldShowSwipeHint(7)).toBe(true) // brand new
        m.recordSwipeHintShown()
        expect(m.shouldShowSwipeHint(7)).toBe(false) // just seen it

        vi.spyOn(Date, "now").mockReturnValue(now + 8 * DAY)
        expect(m.shouldShowSwipeHint(7)).toBe(true) // a week on, still unswiped
        m.recordSwipeHintShown()
        vi.spyOn(Date, "now").mockReturnValue(now + 16 * DAY)
        m.recordSwipeHintShown() // third showing
        vi.spyOn(Date, "now").mockReturnValue(now + 30 * DAY)
        expect(m.shouldShowSwipeHint(7)).toBe(false) // seen it 3 times: stop

        m.resetSwipeHintMemory()
        m.recordSwiped()
        expect(m.shouldShowSwipeHint(0)).toBe(false) // they know how

        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })
})

describe("up next articles", () => {
    it("carry a title, byline, date and opening text", async () => {
        const { UP_NEXT_ARTICLES } = await import("./upNextArticles.js")
        for (const articles of Object.values(UP_NEXT_ARTICLES)) {
            for (const a of articles) {
                expect(a.url.startsWith("https://ourworldindata.org/")).toBe(
                    true
                )
                expect(a.title.length).toBeGreaterThan(0)
                expect(a.authors.length).toBeGreaterThan(0)
                expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
                expect(a.paragraphs.length).toBeGreaterThan(0)
            }
        }
    })
})
