import { expect, Locator, Page, test } from "@playwright/test"
import { FilterType, SearchUrlParam } from "@ourworldindata/types"

// buildFilterTestId in searchUtils.tsx normalizes " and " to " & " in topic
// test IDs. getUrlParam applies the same normalization to URL values.
const buildFilterTestIdFromLabel = (
    baseTestId: string,
    filterType: FilterType,
    filterLabel: string
): string => `${baseTestId}-${filterType}-${encodeURIComponent(filterLabel)}`

const getSearchInput = (page: Page): Locator =>
    page.getByTestId("search-input")

const getHomepageInput = (page: Page): Locator =>
    page.getByTestId("autocomplete-input")

const getUrlParam = (url: string | URL, param: string): string | null => {
    const raw = (url instanceof URL ? url : new URL(url)).searchParams.get(
        param
    )
    if (param === SearchUrlParam.TOPIC && raw) {
        return raw.replaceAll(" and ", " & ")
    }
    return raw
}

// URL sanitization happens asynchronously in a React effect, so wait for the
// final state instead of reading page.url() synchronously.
const expectUrlParam = async (
    page: Page,
    param: string,
    value: string | string[] | null
): Promise<void> => {
    await expect(page).toHaveURL((url) => {
        const raw = getUrlParam(url, param)
        if (value === null) return raw === null
        if (Array.isArray(value)) {
            if (!raw) return false
            const present = raw.split("~").map((item) => item.trim())
            return value.every((item) => present.includes(item))
        }
        return raw === value
    })
}

const openSearch = async (page: Page, url = "/search"): Promise<void> => {
    await page.goto(url)
    await expect(getSearchInput(page)).toBeVisible()
}

const getFilterButton = (
    page: Page,
    baseTestId: string,
    filterType: FilterType,
    label: string
): Locator =>
    page.getByTestId(
        buildFilterTestIdFromLabel(baseTestId, filterType, label)
    )

const selectTopicRefinement = async (
    page: Page,
    topic: string
): Promise<void> => {
    const button = getFilterButton(
        page,
        "search-refinement-button",
        FilterType.TOPIC,
        topic
    )
    await expect(button).toBeVisible()
    await button.click()
}

const selectAutocompleteSuggestion = async (
    page: Page,
    filterType: FilterType,
    label: string
): Promise<void> => {
    const button = getFilterButton(
        page,
        "search-autocomplete-button",
        filterType,
        label
    )
    await expect(button).toBeVisible()
    await button.click()
}

const expectActiveTopic = async (page: Page, topic: string): Promise<void> => {
    await expect(
        getFilterButton(
            page,
            "search-active-filter-button",
            FilterType.TOPIC,
            topic
        )
    ).toBeVisible()
}

const expectActiveCountry = async (
    page: Page,
    country: string
): Promise<void> => {
    await expect(
        page.getByRole("button", {
            name: `Remove ${country} country filter`,
        })
    ).toBeVisible()
}

test.describe("Search", () => {
    test("autocomplete topic filters", async ({ page }) => {
        await openSearch(page)
        await getSearchInput(page).fill("the povert")
        await selectAutocompleteSuggestion(page, FilterType.TOPIC, "Poverty")

        await expectActiveTopic(page, "Poverty")
        await expect(getSearchInput(page)).toHaveValue("")
        await expectUrlParam(page, SearchUrlParam.TOPIC, "Poverty")

        await page.goBack()
        await expectUrlParam(page, SearchUrlParam.TOPIC, null)
    })

    test("autocomplete country filters", async ({ page }) => {
        await openSearch(page)
        await getSearchInput(page).fill("co2 fran")
        await selectAutocompleteSuggestion(
            page,
            FilterType.COUNTRY,
            "France"
        )

        await expectActiveCountry(page, "France")
        await expect(getSearchInput(page)).toHaveValue("co2")
        await expectUrlParam(page, SearchUrlParam.QUERY, "co2")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, "France")

        await page.goBack()
        await expectUrlParam(page, SearchUrlParam.COUNTRY, null)
    })

    test("extracts countries from the query", async ({ page }) => {
        await openSearch(page)
        await getSearchInput(page).fill(
            "co2 france uk germany and the united states"
        )
        await page.keyboard.press("Enter")

        for (const country of [
            "United States",
            "France",
            "United Kingdom",
            "Germany",
        ]) {
            await expectActiveCountry(page, country)
        }
        await expect(getSearchInput(page)).toHaveValue("co2")
        await expectUrlParam(page, SearchUrlParam.QUERY, "co2")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, [
            "France",
            "United Kingdom",
            "Germany",
            "United States",
        ])

        await page.goBack()
        await expectUrlParam(page, SearchUrlParam.COUNTRY, null)
        await expectUrlParam(page, SearchUrlParam.QUERY, null)
    })

    test('applies a "Did you mean?" country filter', async ({ page }) => {
        await openSearch(page)
        await getSearchInput(page).fill("gdp franc")
        await page.keyboard.press("Enter")

        const detectedFilters = page.getByTestId("search-detected-filters")
        await expect(detectedFilters).toBeVisible()
        await expect(
            detectedFilters.getByTestId("search-detected-filters-label")
        ).toHaveText("Did you mean?")
        const franceSuggestion = detectedFilters.getByTestId(
            buildFilterTestIdFromLabel(
                "search-detected-filter-button",
                FilterType.COUNTRY,
                "France"
            )
        )
        await expect(franceSuggestion).toBeVisible()
        await franceSuggestion.click()

        await expectActiveCountry(page, "France")
        await expect(getSearchInput(page)).toHaveValue("gdp")
        await expectUrlParam(page, SearchUrlParam.QUERY, "gdp")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, "France")

        await page.goBack()
        await expectUrlParam(page, SearchUrlParam.COUNTRY, null)
        await expectUrlParam(page, SearchUrlParam.QUERY, null)

        await page.goForward()
        await expectUrlParam(page, SearchUrlParam.QUERY, "gdp")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, "France")
    })

    test("extracts a country when searching from the homepage", async ({
        page,
    }) => {
        await page.goto("/")
        await getHomepageInput(page).click()
        await getHomepageInput(page).fill("co2 france")
        await page.keyboard.press("Enter")

        await expectActiveCountry(page, "France")
        await expect(getSearchInput(page)).toHaveValue("co2")
        await expectUrlParam(page, SearchUrlParam.QUERY, "co2")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, "France")

        await page.goBack()
        await expect(page).toHaveURL("/")
    })

    test("shows autocomplete suggestions only after input", async ({ page }) => {
        await openSearch(page)
        const searchInput = getSearchInput(page)
        const suggestions = page.getByTestId("search-autocomplete-listbox")

        await expect(searchInput).toBeFocused()
        await expect(suggestions).not.toBeVisible()

        await searchInput.fill("gdp")
        await expect(suggestions).toBeVisible()
    })

    test("only autofocuses on initial load", async ({ page }) => {
        await openSearch(page)
        await expect(getSearchInput(page)).toBeFocused()

        await selectTopicRefinement(page, "Population & Demographic Change")

        await expectActiveTopic(page, "Population & Demographic Change")
        await expect(getSearchInput(page)).not.toBeFocused()
    })

    test("discards a local query after filter interactions", async ({ page }) => {
        await openSearch(page)
        await selectTopicRefinement(page, "Population & Demographic Change")
        await expectActiveTopic(page, "Population & Demographic Change")

        await getSearchInput(page).fill("co2")
        await page.keyboard.press("Enter")
        await expect(getSearchInput(page)).toHaveValue("co2")
        await expectUrlParam(page, SearchUrlParam.QUERY, "co2")

        await getSearchInput(page).fill(
            "local query that should be discarded after result type interaction"
        )
        await page.keyboard.press("Escape")
        const resultTypeToggle = page.getByRole("radiogroup", {
            name: "Result type",
        })
        await expect(resultTypeToggle).toBeVisible()
        await resultTypeToggle.getByText("Writing", { exact: true }).click()
        await expect(getSearchInput(page)).toHaveValue("co2")
        await expectUrlParam(page, SearchUrlParam.QUERY, "co2")

        await getSearchInput(page).fill(
            "local query that should be discarded after country interaction"
        )
        await page.getByRole("button", { name: "Open country selector" }).click()
        const albaniaOption = page.getByRole("option", {
            name: "Albania",
            exact: true,
        })
        await expect(albaniaOption).toBeVisible()
        await albaniaOption.click()

        await expectActiveCountry(page, "Albania")
        await expect(getSearchInput(page)).toHaveValue("co2")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, ["Albania"])
        await expectUrlParam(page, SearchUrlParam.QUERY, "co2")
        await expectUrlParam(
            page,
            SearchUrlParam.TOPIC,
            "Population & Demographic Change"
        )
        await expectUrlParam(page, SearchUrlParam.RESULT_TYPE, "writing")
    })

    test("sanitizes an invalid country value from the URL", async ({ page }) => {
        await openSearch(page, "/search?q=gdp&countries=Franc")

        await expect(getSearchInput(page)).toHaveValue("gdp")
        await expectUrlParam(page, SearchUrlParam.QUERY, "gdp")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, null)
        await expectUrlParam(page, SearchUrlParam.TOPIC, null)
    })

    test("sanitizes an unknown parameter name from the URL", async ({
        page,
    }) => {
        await openSearch(page, "/search?r=gdp&countries=France")

        await expectActiveCountry(page, "France")
        await expect(getSearchInput(page)).toHaveValue("")
        await expectUrlParam(page, SearchUrlParam.COUNTRY, "France")
        await expectUrlParam(page, SearchUrlParam.QUERY, null)
    })
})
