// Test all the slugs in the SiteNavigationStatic object and makes sure
// https://ourworldindata.org/{slug} returns a 200

import { SiteNavigationStatic } from "../../site/SiteNavigation.js"

const testSiteNavigation = async () => {
    const slugs = SiteNavigationStatic.categories
        .map((category) => {
            const categorySlugs = category.entries
                .map((entry) => entry.slug)
                .concat(
                    (category.subcategories?.length &&
                        category.subcategories.flatMap((subcategory) =>
                            subcategory.entries.map((entry) => entry.slug)
                        )) ||
                        []
                )
            return categorySlugs
        })
        .flat()

    let promises = slugs.map((slug) => {
        return fetch(`https://ourworldindata.org/${slug}`, {
            method: "HEAD",
        })
    })

    const responses: Response[] = await Promise.all(promises)
    if (responses.some((response) => !response.ok)) {
        console.error(
            "❌ One or more fetches failed: ",
            responses
                .filter((response) => !response.ok)
                .map((response) => response.url)
        )
        return
    }
    console.log("✅ All fetches completed")
}

testSiteNavigation()
