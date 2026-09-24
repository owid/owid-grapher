import { expect, it, describe, vi } from "vitest"
import { parseDataPerspectivesVariant } from "./dataPerspectivesVariant.js"

describe("data perspectives URL variants", () => {
    it("defaults to a left-hand rail with titles", () => {
        expect(parseDataPerspectivesVariant("")).toEqual({
            position: "left",
            layout: "rail",
            density: "title",
            chrome: "bare",
            axes: "articles",
            style: "panel",
            narrativeStale: "hide",
            drawer: "off",
            drawerLayout: "vertical",
            hintDelayMs: 3000,
            hintRepeatDays: 7,
            hintReset: false,
            count: undefined,
            ignored: [],
        })
    })

    it("pairs a side position with a rail and above/below with a strip", () => {
        expect(parseDataPerspectivesVariant("?dp=right").layout).toEqual("rail")
        expect(parseDataPerspectivesVariant("?dp=above").layout).toEqual(
            "strip"
        )
        expect(parseDataPerspectivesVariant("?dp=below").layout).toEqual(
            "strip"
        )
    })

    it("lets an explicit layout override the pairing", () => {
        expect(
            parseDataPerspectivesVariant("?dp=above&dpLayout=grid").layout
        ).toEqual("grid")
    })

    it("reads position, density and count", () => {
        expect(
            parseDataPerspectivesVariant("?dp=off&dpDensity=detail&dpN=3")
        ).toEqual({
            position: "off",
            layout: "strip",
            density: "detail",
            chrome: "bare",
            axes: "articles",
            style: "panel",
            narrativeStale: "hide",
            drawer: "off",
            drawerLayout: "vertical",
            hintDelayMs: 3000,
            hintRepeatDays: 7,
            hintReset: false,
            count: 3,
            ignored: [],
        })
    })

    it("accepts the mobile swipe deck layout", () => {
        expect(
            parseDataPerspectivesVariant("?dp=below&dpLayout=swipe").layout
        ).toEqual("swipe")
    })

    it("accepts every mobile layout", () => {
        for (const layout of ["swipe", "pageswipe", "accordion", "explorer"]) {
            expect(
                parseDataPerspectivesVariant(`?dpLayout=${layout}`).layout
            ).toEqual(layout)
        }
    })

    it("reads the explorer swipe axes, defaulting to articles", () => {
        expect(parseDataPerspectivesVariant("").axes).toEqual("articles")
        expect(parseDataPerspectivesVariant("?dpAxes=pages").axes).toEqual(
            "pages"
        )
        expect(parseDataPerspectivesVariant("?dpAxes=sideways").axes).toEqual(
            "articles"
        )
    })

    it("reads the swipe nudge delay in seconds, defaulting to 3", () => {
        expect(parseDataPerspectivesVariant("").hintDelayMs).toEqual(3000)
        expect(
            parseDataPerspectivesVariant("?dpHintDelay=1.5").hintDelayMs
        ).toEqual(1500)
        expect(
            parseDataPerspectivesVariant("?dpHintDelay=0").hintDelayMs
        ).toEqual(0)
        expect(
            parseDataPerspectivesVariant("?dpHintDelay=-4").hintDelayMs
        ).toEqual(3000)
    })

    it("reads the perspective style, defaulting to panel", () => {
        expect(parseDataPerspectivesVariant("").style).toEqual("panel")
        for (const style of ["panel", "card", "seamless", "narrative"]) {
            expect(
                parseDataPerspectivesVariant(`?dpStyle=${style}`).style
            ).toEqual(style)
        }
        expect(parseDataPerspectivesVariant("?dpStyle=loud").style).toEqual(
            "panel"
        )
    })

    it("waits longer before nudging in pageswipe", () => {
        expect(
            parseDataPerspectivesVariant("?dpLayout=pageswipe").hintDelayMs
        ).toEqual(5000)
        expect(
            parseDataPerspectivesVariant("?dpLayout=pageswipe&dpHintDelay=2")
                .hintDelayMs
        ).toEqual(2000)
    })

    it("reads the drawer, narrative and nudge-memory params", () => {
        const v = parseDataPerspectivesVariant(
            "?dpDrawer=related&dpDrawerLayout=horizontal&dpNarrativeStale=disable&dpHintRepeatDays=14&dpHintReset=1"
        )
        expect(v.drawer).toEqual("related")
        expect(v.drawerLayout).toEqual("horizontal")
        expect(v.narrativeStale).toEqual("disable")
        expect(v.hintRepeatDays).toEqual(14)
        expect(v.hintReset).toBe(true)
        expect(
            parseDataPerspectivesVariant("?dpDrawer=everywhere").drawer
        ).toEqual("off")
    })

    it("is forgiving about case and singular/plural", () => {
        const v = parseDataPerspectivesVariant(
            "?dpdrawer=Perspective&DPLAYOUT=pageswipe&dpStyle=NARRATIVE"
        )
        expect(v.drawer).toEqual("perspectives")
        expect(v.layout).toEqual("pageswipe")
        expect(v.style).toEqual("narrative")
        expect(v.ignored).toEqual([])
        expect(
            parseDataPerspectivesVariant("?dpDrawer=metadata").drawer
        ).toEqual("metadata")
    })

    it("reports what it couldn't use, rather than silently ignoring it", () => {
        expect(
            parseDataPerspectivesVariant(
                "?dpDrawer=foo&dpDrawr=perspectives&dpN=lots&country=~SWE"
            ).ignored
        ).toEqual(["dpDrawr=perspectives", "dpDrawer=foo", "dpN=lots"])
    })

    it("keeps full chart chrome when asked", () => {
        expect(parseDataPerspectivesVariant("?dpChrome=full").chrome).toEqual(
            "full"
        )
    })

    it("ignores unknown or nonsensical values", () => {
        const v = parseDataPerspectivesVariant(
            "?dp=sideways&dpDensity=huge&dpN=-2"
        )
        expect(v.position).toEqual("left")
        expect(v.density).toEqual("title")
        expect(v.count).toBeUndefined()
    })
})

describe("data perspective fixtures", () => {
    it("every perspective names its tab explicitly", async () => {
        const { DATA_PERSPECTIVES } =
            await import("./dataPerspectivesFixtures.js")
        for (const [slug, perspectives] of Object.entries(DATA_PERSPECTIVES)) {
            for (const p of perspectives) {
                const params = new URLSearchParams(p.queryParams)
                expect(
                    params.has("tab"),
                    `${slug}: "${p.queryParams}" has no tab`
                ).toBe(true)
            }
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
