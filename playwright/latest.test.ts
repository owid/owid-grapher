import { expect, Locator, Page, test } from "@playwright/test"
import { LatestUrlParam } from "@ourworldindata/types"
import {
    EXPERIMENT_PREFIX,
    LATEST_STICKY_FILTERS_EXPERIMENT_ID,
} from "@ourworldindata/utils"

// The feed is live Algolia data, so no test names a specific article or data
// update — they all work off "the first card of type X".

// The /latest cards carry no test ids; their BEM block classes are the stable
// handle the SCSS already relies on, and they are what distinguishes one card
// type from another in the feed. Everything the reader interacts with —
// filters, view toggle, links, copy link — is located by role instead.
const CARD_SELECTORS = {
    dataUpdate: ".latest-data-update-hit",
    dataInsight: ".latest-data-insight-hit",
    dataInsightExpanded: ".latest-data-insight-expanded",
    article: ".latest-article-hit",
    announcement: ".latest-announcement-hit",
} as const

const ALL_CARDS_SELECTOR = Object.values(CARD_SELECTORS).join(", ")

const STICKY_FILTERS_COOKIE = `${EXPERIMENT_PREFIX}-${LATEST_STICKY_FILTERS_EXPERIMENT_ID}`

type StickyFiltersArm = "reveal-on-scroll-up" | "not-sticky" | "fully-sticky"

// --- Locators ---

const getFacetsContainer = (page: Page): Locator =>
    page.locator(".latest-search__facets-container")

const getViewToggle = (page: Page): Locator =>
    page.getByRole("radiogroup", { name: "View:" })

const getFirstDataUpdateCard = (page: Page): Locator =>
    page.locator(CARD_SELECTORS.dataUpdate).first()

const getBreadcrumbLink = (page: Page): Locator =>
    page.locator(".latest-breadcrumb a")

// The topic pills are a react-aria ToggleButtonGroup in single-selection
// mode, so they expose themselves as a radiogroup — as does the view toggle,
// hence the scoping.
const getTopicPill = (page: Page, topic: string): Locator =>
    page
        .locator(".latest-topic-facets__topic-pills")
        .getByRole("radio", { name: topic === "All" ? "All topics" : topic })

// --- Navigation ---

/**
 * The feed shows skeleton cards until the first Algolia page *and* its bake
 * probes have settled. Waiting for the skeletons to go is the only reliable
 * "the feed is ready" signal on first load; filter changes keep the previous
 * results on screen (keepPreviousData) and show no skeleton at all, so those
 * are awaited through the assertions instead.
 */
const waitForFeed = async (page: Page): Promise<void> => {
    await expect(page.locator(".latest-hit-skeleton").first()).toBeHidden()
    await expect(page.locator(ALL_CARDS_SELECTOR).first()).toBeVisible()
}

const openLatest = async (page: Page, url = "/latest"): Promise<void> => {
    await page.goto(url)
    await waitForFeed(page)
}

// The middleware that stamps the arm's body class doesn't run under `make up`,
// so the cookie is set by hand and the class applied with it — see the
// "Sticky filters experiment" section of site/latest/README.md. The class has
// to land before the app mounts, the way the middleware delivers it: it adds
// the pinned bar's padding, which grows the bar's border box without touching
// its content box, so a class applied afterwards leaves the reveal hook
// holding a stale height and the bar parked too low.
const openLatestInStickyFiltersArm = async (
    page: Page,
    arm: StickyFiltersArm
): Promise<void> => {
    // Visit first only to learn the origin the cookie has to be scoped to,
    // since the base URL differs between local dev and CI.
    await page.goto("/latest")
    await page.context().addCookies([
        {
            name: STICKY_FILTERS_COOKIE,
            value: arm,
            url: new URL(page.url()).origin,
        },
    ])
    await page.addInitScript(
        ({ cookie, arm }) => {
            document.addEventListener("DOMContentLoaded", () =>
                document.body.classList.add(`${cookie}--${arm}`)
            )
        },
        { cookie: STICKY_FILTERS_COOKIE, arm }
    )
    await page.reload()
    await waitForFeed(page)
}

// --- Actions ---

const filterByType = async (page: Page, label: string): Promise<void> => {
    await page.locator(".latest-topic-facets__content-type-trigger").click()
    // The "All" option is labelled "All types" for screen readers, since "All"
    // alone doesn't say which axis it clears.
    const option = page.getByRole("option", {
        name: label === "All" ? "All types" : label,
        exact: true,
    })
    await expect(option).toBeVisible()
    await option.click()
}

const selectTopicPill = async (page: Page, topic: string): Promise<void> => {
    const pill = getTopicPill(page, topic)
    await expect(pill).toBeVisible()
    await pill.click()
}

// react-aria hides the real radio input for styling, so the label is what a
// reader actually clicks.
const selectView = async (page: Page, view: string): Promise<void> => {
    const option = getViewToggle(page)
        .locator(".latest-view-toggle__option")
        .filter({ hasText: view })
    await expect(option).toBeVisible()
    await option.click()
}

const openFirstDataUpdateCard = async (page: Page): Promise<void> => {
    await getFirstDataUpdateCard(page)
        .locator("a.latest-data-update-hit__card")
        .click()
}

// Reads the slug off the first card and navigates to its hash link, the way
// the homepage links into the feed. Returns the slug so the test can find the
// card again.
const deepLinkToFirstDataUpdateCard = async (page: Page): Promise<string> => {
    const slug = await getFirstDataUpdateCard(page).getAttribute("id")
    if (!slug) throw new Error("The first data update card has no id")
    await page.goto(`/latest#${slug}`)
    // Adding a hash to the URL we're already on is a same-document
    // navigation, which wouldn't remount the app — and the auto-expansion
    // only happens as the feed's first data load settles.
    await page.reload()
    await waitForFeed(page)
    return slug
}

/**
 * The reveal hook reads scroll direction once per animation frame, so two
 * scripted scrolls in quick succession would coalesce into a single reading
 * and the page would never see a change of direction. Waiting a frame out
 * after each scroll is what makes a scripted scroll behave like a real one.
 */
const scrollBy = async (page: Page, offset: number): Promise<void> => {
    await page.evaluate((offset) => window.scrollBy(0, offset), offset)
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
    )
}

const scrollDownFeed = (page: Page): Promise<void> => scrollBy(page, 1500)

const scrollBackUpFeed = (page: Page): Promise<void> => scrollBy(page, -500)

// --- Assertions ---

const expectUrlParam = async (
    page: Page,
    param: string,
    value: string | null
): Promise<void> => {
    await expect(page).toHaveURL((url) => {
        const raw = new URL(url).searchParams.get(param)
        return value === null ? raw === null : raw === value
    })
}

// Asserted as the absence of every other card type rather than by comparing
// counts: the previous results stay on screen while the filtered page loads
// (keepPreviousData), and only an auto-retrying assertion rides that out.
const expectOnlyDataUpdateCards = async (page: Page): Promise<void> => {
    await expect(page.locator(CARD_SELECTORS.dataUpdate).first()).toBeVisible()
    const otherCards = Object.entries(CARD_SELECTORS)
        .filter(([type]) => type !== "dataUpdate")
        .map(([, selector]) => selector)
        .join(", ")
    await expect(page.locator(otherCards)).toHaveCount(0)
}

const expectFirstDataUpdateCardCompact = async (page: Page): Promise<void> => {
    await expect(
        getFirstDataUpdateCard(page).locator(
            "a.latest-data-update-hit__card--collapsed"
        )
    ).toBeVisible()
}

const expectFirstDataUpdateCardExpanded = async (page: Page): Promise<void> => {
    // Expanded cards drop the wrapping link entirely, so the absence of a
    // collapsed card anywhere in the feed is what "expanded" means here.
    await expect(
        page.locator(".latest-data-update-hit__card--collapsed")
    ).toHaveCount(0)
    await expect(
        getFirstDataUpdateCard(page).locator("div.latest-data-update-hit__card")
    ).toBeVisible()
}

const expectFirstDataInsightCardExpanded = async (
    page: Page
): Promise<void> => {
    await expect(
        page.locator(CARD_SELECTORS.dataInsightExpanded).first()
    ).toBeVisible()
}

const expectFirstDataInsightCardCompact = async (page: Page): Promise<void> => {
    await expect(page.locator(CARD_SELECTORS.dataInsight).first()).toBeVisible()
    await expect(page.locator(CARD_SELECTORS.dataInsightExpanded)).toHaveCount(
        0
    )
}

/*
 * The three arms are told apart by where the filter bar ends up, not by the
 * class the reveal hook sets: the arm is only half React — the pinned
 * position and the slide are CSS keyed off the body class — so a test that
 * watched the class alone would pass with none of that CSS applied.
 *
 * Scrolled down, the bar is fully pinned in the fully-sticky arm and out of
 * view in the other two — in the reveal arm because it parks its own height
 * above the pin point, which is what scrolling back up undoes.
 */
const expectFiltersFullyInView = async (page: Page): Promise<void> => {
    await expect(getFacetsContainer(page)).toBeInViewport({ ratio: 1 })
}

const expectFiltersOutOfView = async (page: Page): Promise<void> => {
    await expect(getFacetsContainer(page)).not.toBeInViewport()
}

// --- Tests ---

test.describe("Latest feed", () => {
    test("Filtering the feed by content type", async ({ page }) => {
        await openLatest(page)
        await filterByType(page, "Data updates")
        await expectUrlParam(page, LatestUrlParam.TYPE, "data-update")
        await expectOnlyDataUpdateCards(page)
        await filterByType(page, "All")
        await expectUrlParam(page, LatestUrlParam.TYPE, null)
    })

    test("Data updates expand in place under their type filter", async ({
        page,
    }) => {
        await openLatest(page)
        await expectFirstDataUpdateCardCompact(page)
        await filterByType(page, "Data updates")
        await expectFirstDataUpdateCardExpanded(page)
        await expect(
            getFirstDataUpdateCard(page).getByRole("button", {
                name: "Copy link to clipboard",
            })
        ).toBeVisible()
    })

    test("A compact data update card links to its standalone page", async ({
        page,
    }) => {
        await openLatest(page)
        await openFirstDataUpdateCard(page)
        await expect(page).not.toHaveURL(/\/latest/)
        await expect(page.locator(".standalone-post-page")).toBeVisible()
        await expect(getBreadcrumbLink(page)).toHaveText("Data updates")
        await getBreadcrumbLink(page).click()
        await expectUrlParam(page, LatestUrlParam.TYPE, "data-update")
    })

    test("Data insights read in place, with an Expanded/Compact toggle", async ({
        page,
    }) => {
        await openLatest(page)
        await expect(getViewToggle(page)).toBeHidden()
        await filterByType(page, "Data Insights")
        await expect(getViewToggle(page)).toBeVisible()
        await expect(
            getViewToggle(page).getByRole("radio", {
                name: "Expanded",
                exact: true,
            })
        ).toBeChecked()
        await expectFirstDataInsightCardExpanded(page)
        await selectView(page, "Compact")
        await expectFirstDataInsightCardCompact(page)
    })

    test("Filtering the feed by topic", async ({ page }) => {
        const topic = "Population and Demographic Change"
        await openLatest(page)
        await selectTopicPill(page, topic)
        await expectUrlParam(page, LatestUrlParam.TOPICS, topic)
        await selectTopicPill(page, "All")
        await expectUrlParam(page, LatestUrlParam.TOPICS, null)
    })

    test("URL sanitization of a legacy topic param", async ({ page }) => {
        await openLatest(page, "/latest?topic=Health")
        await expectUrlParam(page, LatestUrlParam.TOPICS, null)
        await expectUrlParam(page, LatestUrlParam.TYPE, null)
    })

    test("URL sanitization of an unknown type value", async ({ page }) => {
        await openLatest(page, "/latest?type=not-a-type")
        await expectUrlParam(page, LatestUrlParam.TYPE, null)
    })

    test("Deep-linked data updates expand on arrival", async ({ page }) => {
        await openLatest(page)
        const slug = await deepLinkToFirstDataUpdateCard(page)
        const card = page.locator(`${CARD_SELECTORS.dataUpdate}[id="${slug}"]`)
        await expect(
            card.locator("div.latest-data-update-hit__card")
        ).toBeVisible()
    })
})

test.describe("Latest feed sticky filters", () => {
    test("The reveal-on-scroll-up arm brings the filters back on scrolling up", async ({
        page,
    }) => {
        await openLatestInStickyFiltersArm(page, "reveal-on-scroll-up")
        await scrollDownFeed(page)
        await expectFiltersOutOfView(page)
        await scrollBackUpFeed(page)
        await expectFiltersFullyInView(page)
    })

    test("The not-sticky arm leaves the filters behind", async ({ page }) => {
        await openLatestInStickyFiltersArm(page, "not-sticky")
        await scrollDownFeed(page)
        await expectFiltersOutOfView(page)
        await scrollBackUpFeed(page)
        await expectFiltersOutOfView(page)
    })

    test("The fully-sticky arm keeps the filters pinned", async ({ page }) => {
        await openLatestInStickyFiltersArm(page, "fully-sticky")
        await scrollDownFeed(page)
        await expectFiltersFullyInView(page)
        await scrollBackUpFeed(page)
        await expectFiltersFullyInView(page)
    })
})
