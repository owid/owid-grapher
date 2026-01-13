import { expect, Locator, Page } from "@playwright/test"
import { createBdd } from "playwright-bdd"
import { FilterType, SearchUrlParam } from "@ourworldindata/types"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"

const { Given, When, Then } = createBdd()

const getSearchInput = (page: Page): Locator => page.getByTestId("search-input")

const buildFilterTestId = (
    baseTestId: string,
    filterType: FilterType,
    filterName: string
): string => `${baseTestId}-${filterType}-${encodeURIComponent(filterName)}`

const getTopicFromUrl = (url: string): string | null => {
    const params = new URL(url).searchParams
    return params.get(SearchUrlParam.TOPIC)
}

Given("I am on the search page", async ({ page }) => {
    await page.goto(`${BAKED_BASE_URL}/search`)
    await expect(getSearchInput(page)).toBeVisible()
})

When("I type {string} in the search input", async ({ page }, query) => {
    const input = getSearchInput(page)
    await input.fill(query)
})

When("I select the topic suggestion {string}", async ({ page }, topic) => {
    const suggestionButton = page.getByTestId(
        buildFilterTestId("search-autocomplete-button", FilterType.TOPIC, topic)
    )
    await expect(suggestionButton).toBeVisible()
    await suggestionButton.click()
})

Then("I see {string} as an active topic filter", async ({ page }, topic) => {
    const activeFilterButton = page.getByTestId(
        buildFilterTestId(
            "search-active-filter-button",
            FilterType.TOPIC,
            topic
        )
    )
    await expect(activeFilterButton).toBeVisible()
})

Then(
    "the search input is cleared after the topic is applied",
    async ({ page }) => {
        const input = getSearchInput(page)
        await expect(input).toHaveValue("")
    }
)

Then("the url contains the topic filter {string}", async ({ page }, topic) => {
    const topicInUrl = getTopicFromUrl(page.url())
    expect(topicInUrl).toBe(topic)
})

When("I navigate back to the previous search state", async ({ page }) => {
    await page.goBack()
})

Then("the url no longer contains topic filters", async ({ page }) => {
    const topicInUrl = getTopicFromUrl(page.url())
    expect(topicInUrl).toBeNull()
})
