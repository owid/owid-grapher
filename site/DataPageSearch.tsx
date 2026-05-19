import { Autocomplete } from "./search/Autocomplete.js"
import { SuggestedSearches } from "./DataPageRelatedContent.js"

// Standalone "Search all our content" block that sits between the data
// page's metadata section and the "Keep exploring" feed. Separated from
// DataPageRelatedContent so the search affordance reads as its own thing
// rather than as part of the related-content list.
export default function DataPageSearch({ slug }: { slug: string | undefined }) {
    return (
        <section className="data-page-search">
            <h2 className="data-page-search__title">Search all our content</h2>
            <Autocomplete
                id="data-page-search-autocomplete"
                className="data-page-search__bar"
                placeholder="Search for an indicator, a topic, a country, or a keyword…"
            />
            <SuggestedSearches slug={slug} />
        </section>
    )
}
