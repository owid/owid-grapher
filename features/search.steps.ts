import { expect, Locator, Page } from "@playwright/test"
import { createBdd } from "playwright-bdd"
import { FilterType, SearchUrlParam } from "@ourworldindata/types"

// No " and " → " & " transformation needed here because
// buildFilterTestId in searchUtils.tsx already normalizes topic names
// in test IDs. See also getTopicFromUrl below for URL normalization.
const buildFilterTestIdFromLabel = (
    baseTestId: string,
    filterType: FilterType,
    filterLabel: string
): string => `${baseTestId}-${filterType}-${encodeURIComponent(filterLabel)}`

const { Given, When, Then } = createBdd()

const getSearchAutocompleteInput = (page: Page): Locator =>
    page.getByTestId("search-input")

const getHomepageAutocompleteInput = (page: Page): Locator =>
    page.getByTestId("autocomplete-input")

const getUrlParam = (url: string, param: string): string | null => {
    const params = new URL(url).searchParams
    return params.get(param)
}

const getTopicFromUrl = (url: string): string | null => {
    const topic = getUrlParam(url, SearchUrlParam.TOPIC)
    // Topic names use " and " in URLs but are displayed as " & ".
    // See also buildFilterTestId in searchUtils.tsx for the same
    // transformation applied to test IDs.
    return topic?.replaceAll(" and ", " & ") ?? null
}

const getQueryFromUrl = (url: string): string | null =>
    getUrlParam(url, SearchUrlParam.QUERY)

const getCountriesFromUrl = (url: string): string | null =>
    getUrlParam(url, SearchUrlParam.COUNTRY)

const getResultTypeFromUrl = (url: string): string | null =>
    getUrlParam(url, SearchUrlParam.RESULT_TYPE)

// --- Given steps ---

Given("I am on the search page", async ({ page }) => {
    await page.goto(`/search`)
    await expect(getSearchAutocompleteInput(page)).toBeVisible()
})

Given("I am on the homepage", async ({ page }) => {
    await page.goto(`/`)
})

Given(
    "I am on the search page with the url {string}",
    async ({ page }, url) => {
        await page.goto(url)
    }
)

// --- When steps ---

When(
    "I type {string} in the search autocomplete input",
    async ({ page }, query) => {
        await getSearchAutocompleteInput(page).fill(query)
    }
)

When(
    "I type {string} in the homepage autocomplete input",
    async ({ page }, query) => {
        await getHomepageAutocompleteInput(page).fill(query)
    }
)

When("I select the topic refinement {string}", async ({ page }, topic) => {
    const button = page.getByTestId(
        buildFilterTestIdFromLabel(
            "search-refinement-button",
            FilterType.TOPIC,
            topic
        )
    )
    await expect(button).toBeVisible()
    await button.click()
})

When("I select the topic suggestion {string}", async ({ page }, topic) => {
    const suggestionButton = page.getByTestId(
        buildFilterTestIdFromLabel(
            "search-autocomplete-button",
            FilterType.TOPIC,
            topic
        )
    )
    await expect(suggestionButton).toBeVisible()
    await suggestionButton.click()
})

When("I select the country suggestion {string}", async ({ page }, country) => {
    const suggestionButton = page.getByTestId(
        buildFilterTestIdFromLabel(
            "search-autocomplete-button",
            FilterType.COUNTRY,
            country
        )
    )
    await expect(suggestionButton).toBeVisible()
    await suggestionButton.click()
})

When("I select the result type {string}", async ({ page }, resultType) => {
    const resultTypeToggle = page.getByRole("radiogroup", {
        name: "Result type",
    })
    await expect(resultTypeToggle).toBeVisible()
    await resultTypeToggle.getByText(resultType, { exact: true }).click()
})

When(
    "I add the country {string} from the country selector",
    async ({ page }, country) => {
        const openCountrySelectorButton = page.getByRole("button", {
            name: "Open country selector",
        })
        await expect(openCountrySelectorButton).toBeVisible()
        await openCountrySelectorButton.click()

        const countryOption = page.getByRole("option", {
            name: country,
            exact: true,
        })
        await expect(countryOption).toBeVisible()
        await countryOption.click()
    }
)

When("I press {string}", async ({ page }, key) => {
    await page.keyboard.press(key)
})

When("I click on the homepage autocomplete input", async ({ page }) => {
    await getHomepageAutocompleteInput(page).click()
})

When("I navigate back to the previous search state", async ({ page }) => {
    await page.goBack()
})

When("I navigate back to the previous page", async ({ page }) => {
    await page.goBack()
})

When("I navigate forward", async ({ page }) => {
    await page.goForward()
})

When("I click on the {string} suggestion", async ({ page }, suggestionName) => {
    const suggestionsContainer = page.getByTestId("search-detected-filters")
    await expect(suggestionsContainer).toBeVisible()
    const button = suggestionsContainer.getByTestId(
        buildFilterTestIdFromLabel(
            "search-detected-filter-button",
            FilterType.COUNTRY,
            suggestionName
        )
    )
    await expect(button).toBeVisible()
    await button.click()
})

// --- Then steps ---

Then("I see {string} as an active topic filter", async ({ page }, topic) => {
    const activeFilterButton = page.getByTestId(
        buildFilterTestIdFromLabel(
            "search-active-filter-button",
            FilterType.TOPIC,
            topic
        )
    )
    await expect(activeFilterButton).toBeVisible()
})

Then(
    "I see {string} as an active country filter",
    async ({ page }, country) => {
        const activeFilterButton = page.getByRole("button", {
            name: `Remove ${country} country filter`,
        })
        await expect(activeFilterButton).toBeVisible()
    }
)

Then(
    "the search autocomplete input is cleared after the topic is applied",
    async ({ page }) => {
        await expect(getSearchAutocompleteInput(page)).toHaveValue("")
    }
)

Then(
    "the search autocomplete input contains {string}",
    async ({ page }, value) => {
        await expect(getSearchAutocompleteInput(page)).toHaveValue(value)
    }
)

Then(
    "the search autocomplete input shows the placeholder text",
    async ({ page }) => {
        await expect(getSearchAutocompleteInput(page)).toHaveValue("")
    }
)

Then("the url contains the topic filter {string}", async ({ page }, topic) => {
    const topicInUrl = getTopicFromUrl(page.url())
    expect(topicInUrl).toBe(topic)
})

Then("the url no longer contains topic filters", async ({ page }) => {
    const topicInUrl = getTopicFromUrl(page.url())
    expect(topicInUrl).toBeNull()
})

Then("the url no longer contains country filters", async ({ page }) => {
    const countriesInUrl = getCountriesFromUrl(page.url())
    expect(countriesInUrl).toBeNull()
})

Then("the url no longer contains query filters", async ({ page }) => {
    const queryInUrl = getQueryFromUrl(page.url())
    expect(queryInUrl).toBeNull()
})

Then(
    "the url contains the country filter {string}",
    async ({ page }, country) => {
        const countriesInUrl = getCountriesFromUrl(page.url())
        expect(countriesInUrl).toBeTruthy()
        const countries = countriesInUrl!.split("~").map((item) => item.trim())
        expect(countries).toContain(country)
    }
)

Then(
    "the url contains the result type {string}",
    async ({ page }, resultType) => {
        const resultTypeInUrl = getResultTypeFromUrl(page.url())
        expect(resultTypeInUrl).toBe(resultType)
    }
)

Then(
    "the url contains the query {string} and the topic filter {string}",
    async ({ page }, query, topic) => {
        expect(getQueryFromUrl(page.url())).toBe(query)
        expect(getTopicFromUrl(page.url())).toBe(topic)
    }
)

Then(
    "the url contains the query {string}, the topic filter {string}, and the country {string}",
    async ({ page }, query, topic, country) => {
        expect(getQueryFromUrl(page.url())).toBe(query)
        expect(getTopicFromUrl(page.url())).toBe(topic)
        expect(getCountriesFromUrl(page.url())).toBe(country)
    }
)

Then(
    "the url contains the query {string} and the country {string}",
    async ({ page }, query, country) => {
        expect(getQueryFromUrl(page.url())).toBe(query)
        expect(getCountriesFromUrl(page.url())).toBe(country)
    }
)

Then(
    "the url contains the query {string} and the countries {string}, {string}, {string}, and {string}",
    async ({ page }, query, country1, country2, country3, country4) => {
        expect(getQueryFromUrl(page.url())).toBe(query)
        const countriesParam = getCountriesFromUrl(page.url())
        expect(countriesParam).toBeTruthy()
        const countries = countriesParam!.split("~").map((c) => c.trim())
        expect(countries).toContain(country1)
        expect(countries).toContain(country2)
        expect(countries).toContain(country3)
        expect(countries).toContain(country4)
    }
)

Then("the url contains the query {string}", async ({ page }, query) => {
    expect(getQueryFromUrl(page.url())).toBe(query)
})

Then(
    "the url is sanitized to only contain the query {string}",
    async ({ page }, query) => {
        expect(getQueryFromUrl(page.url())).toBe(query)
        expect(getCountriesFromUrl(page.url())).toBeNull()
        expect(getTopicFromUrl(page.url())).toBeNull()
    }
)

Then(
    "the url is sanitized to only contain the country {string}",
    async ({ page }, country) => {
        expect(getCountriesFromUrl(page.url())).toBe(country)
        expect(getQueryFromUrl(page.url())).toBeNull()
    }
)

Then("the search autocomplete input should be focused", async ({ page }) => {
    await expect(getSearchAutocompleteInput(page)).toBeFocused()
})

Then(
    "the search autocomplete input should not be focused",
    async ({ page }) => {
        await expect(getSearchAutocompleteInput(page)).not.toBeFocused()
    }
)

Then("suggestions should not be visible", async ({ page }) => {
    const suggestions = page.getByTestId("search-autocomplete-listbox")
    await expect(suggestions).not.toBeVisible()
})

Then("suggestions should be visible", async ({ page }) => {
    const suggestions = page.getByTestId("search-autocomplete-listbox")
    await expect(suggestions).toBeVisible()
})

Then("I see a {string} suggestion", async ({ page }, label) => {
    const container = page.getByTestId("search-detected-filters")
    await expect(container).toBeVisible()
    await expect(
        container.getByTestId("search-detected-filters-label")
    ).toHaveText(label)
})

Then(
    '{string} is shown as a "Did you mean?" suggestion',
    async ({ page }, name) => {
        const container = page.getByTestId("search-detected-filters")
        await expect(container).toBeVisible()
        const button = container.getByTestId(
            buildFilterTestIdFromLabel(
                "search-detected-filter-button",
                FilterType.COUNTRY,
                name
            )
        )
        await expect(button).toBeVisible()
    }
)

Then("I should be on the homepage", async ({ page }) => {
    await expect(page).toHaveURL("/")
})
