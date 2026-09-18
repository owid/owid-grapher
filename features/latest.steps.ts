import { expect, Locator, Page } from "@playwright/test"
import { createBdd } from "playwright-bdd"
import { LatestUrlParam } from "@ourworldindata/types"
import {
    EXPERIMENT_PREFIX,
    LATEST_STICKY_FILTERS_EXPERIMENT_ID,
} from "@ourworldindata/utils"

const { Given, When, Then } = createBdd()

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

const getFacetsContainer = (page: Page): Locator =>
    page.locator(".latest-search__facets-container")

const getViewToggle = (page: Page): Locator =>
    page.getByRole("radiogroup", { name: "View:" })

const getFirstDataUpdateCard = (page: Page): Locator =>
    page.locator(CARD_SELECTORS.dataUpdate).first()

// The topic pills are a react-aria ToggleButtonGroup in single-selection
// mode, so they expose themselves as a radiogroup — as does the view toggle,
// hence the scoping.
const getTopicPill = (page: Page, topic: string): Locator =>
    page
        .locator(".latest-topic-facets__topic-pills")
        .getByRole("radio", { name: topic === "All" ? "All topics" : topic })

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

// --- Given steps ---

Given("I am on the latest page", async ({ page }) => {
    await page.goto("/latest")
    await waitForFeed(page)
})

Given(
    "I am on the latest page with the url {string}",
    async ({ page }, url) => {
        await page.goto(url)
        await waitForFeed(page)
    }
)

// The middleware that stamps the arm's body class doesn't run under `make up`,
// so the cookie is set by hand and the class applied with it — see the
// "Sticky filters experiment" section of site/latest/README.md. The class has
// to land before the app mounts, the way the middleware delivers it: it adds
// the pinned bar's padding, which grows the bar's border box without touching
// its content box, so a class applied afterwards leaves the reveal hook
// holding a stale height and the bar parked too low.
Given(
    "I am on the latest page in the {string} sticky filters arm",
    async ({ page }, arm) => {
        // Visit first only to learn the origin the cookie has to be scoped
        // to, since the base URL differs between local dev and CI.
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
)

// --- When steps ---

When("I filter the feed by type {string}", async ({ page }, label) => {
    await page.locator(".latest-topic-facets__content-type-trigger").click()
    // The "All" option is labelled "All types" for screen readers, since "All"
    // alone doesn't say which axis it clears.
    const option = page.getByRole("option", {
        name: label === "All" ? "All types" : label,
        exact: true,
    })
    await expect(option).toBeVisible()
    await option.click()
})

When("I select the topic pill {string}", async ({ page }, topic) => {
    const pill = getTopicPill(page, topic)
    await expect(pill).toBeVisible()
    await pill.click()
})

// react-aria hides the real radio input for styling, so the label is what a
// reader actually clicks.
When("I select the {string} view", async ({ page }, view) => {
    const option = getViewToggle(page)
        .locator(".latest-view-toggle__option")
        .filter({ hasText: view })
    await expect(option).toBeVisible()
    await option.click()
})

When("I open the first data update card", async ({ page }) => {
    await getFirstDataUpdateCard(page)
        .locator("a.latest-data-update-hit__card")
        .click()
})

// Reads the slug off the first card and navigates to its hash link, the way
// the homepage links into the feed. One step rather than two, so the slug
// doesn't have to be carried between steps.
When("I deep-link to the first data update card", async ({ page }) => {
    const slug = await getFirstDataUpdateCard(page).getAttribute("id")
    expect(slug).toBeTruthy()
    await page.goto(`/latest#${slug}`)
    // Adding a hash to the URL we're already on is a same-document
    // navigation, which wouldn't remount the app — and the auto-expansion
    // only happens as the feed's first data load settles.
    await page.reload()
    await waitForFeed(page)
})

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

When("I scroll down the feed", async ({ page }) => {
    await scrollBy(page, 1500)
})

When("I scroll back up the feed", async ({ page }) => {
    await scrollBy(page, -500)
})

When("I follow the breadcrumb back to the feed", async ({ page }) => {
    await page.locator(".latest-breadcrumb a").click()
})

// --- Then steps ---

Then("the feed is filtered to the type {string}", async ({ page }, type) => {
    await expectUrlParam(page, LatestUrlParam.TYPE, type)
})

Then("the feed is no longer filtered by type", async ({ page }) => {
    await expectUrlParam(page, LatestUrlParam.TYPE, null)
})

Then("the feed is filtered to the topic {string}", async ({ page }, topic) => {
    await expectUrlParam(page, LatestUrlParam.TOPICS, topic)
})

Then("the feed is no longer filtered by topic", async ({ page }) => {
    await expectUrlParam(page, LatestUrlParam.TOPICS, null)
})

// Asserted as the absence of every other card type rather than by comparing
// counts: the previous results stay on screen while the filtered page loads
// (keepPreviousData), and only an auto-retrying assertion rides that out.
Then("every card in the feed is a data update", async ({ page }) => {
    await expect(page.locator(CARD_SELECTORS.dataUpdate).first()).toBeVisible()
    const otherCards = Object.entries(CARD_SELECTORS)
        .filter(([type]) => type !== "dataUpdate")
        .map(([, selector]) => selector)
        .join(", ")
    await expect(page.locator(otherCards)).toHaveCount(0)
})

Then("the first data update card is compact", async ({ page }) => {
    await expect(
        getFirstDataUpdateCard(page).locator(
            "a.latest-data-update-hit__card--collapsed"
        )
    ).toBeVisible()
})

Then("the first data update card is expanded", async ({ page }) => {
    // Expanded cards drop the wrapping link entirely, so the absence of a
    // collapsed card anywhere in the feed is what "expanded" means here.
    await expect(
        page.locator(".latest-data-update-hit__card--collapsed")
    ).toHaveCount(0)
    await expect(
        getFirstDataUpdateCard(page).locator("div.latest-data-update-hit__card")
    ).toBeVisible()
})

Then("the first data update card offers a copy link", async ({ page }) => {
    await expect(
        getFirstDataUpdateCard(page).getByRole("button", {
            name: "Copy link to clipboard",
        })
    ).toBeVisible()
})

Then("the deep-linked data update card is expanded", async ({ page }) => {
    const slug = new URL(page.url()).hash.slice(1)
    const card = page.locator(`${CARD_SELECTORS.dataUpdate}[id="${slug}"]`)
    await expect(card.locator("div.latest-data-update-hit__card")).toBeVisible()
})

Then("the first data insight card is expanded", async ({ page }) => {
    await expect(
        page.locator(CARD_SELECTORS.dataInsightExpanded).first()
    ).toBeVisible()
})

Then("the first data insight card is compact", async ({ page }) => {
    await expect(page.locator(CARD_SELECTORS.dataInsight).first()).toBeVisible()
    await expect(page.locator(CARD_SELECTORS.dataInsightExpanded)).toHaveCount(
        0
    )
})

Then("I see the view toggle", async ({ page }) => {
    await expect(getViewToggle(page)).toBeVisible()
})

Then("I do not see the view toggle", async ({ page }) => {
    await expect(getViewToggle(page)).toBeHidden()
})

Then("the view toggle is set to {string}", async ({ page }, view) => {
    await expect(
        getViewToggle(page).getByRole("radio", { name: view, exact: true })
    ).toBeChecked()
})

Then("I am on a standalone page", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/latest/)
    await expect(page.locator(".standalone-post-page")).toBeVisible()
})

Then(
    "the breadcrumb links back to the {string} feed",
    async ({ page }, label) => {
        await expect(page.locator(".latest-breadcrumb a")).toHaveText(label)
    }
)

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
Then("the filters are fully in view", async ({ page }) => {
    await expect(getFacetsContainer(page)).toBeInViewport({ ratio: 1 })
})

Then("the filters have scrolled out of view", async ({ page }) => {
    await expect(getFacetsContainer(page)).not.toBeInViewport()
})
