import { Fragment, type ReactElement, useMemo } from "react"
import * as R from "remeda"
import { useQuery } from "@tanstack/react-query"
import { SearchResultType } from "@ourworldindata/types"
import { useSearchContext } from "./SearchContext.js"
import { findWholeTopicInView } from "./searchUtils.js"
import { isQueryKeptAsTyped } from "./searchState.js"
import { fetchTopicVocabulary, suggestedKeywords } from "./topicVocabulary.js"
import { searchQueryKeys } from "./queries.js"

// The vocabulary's generator publishes more terms per topic than read as a
// suggestion; past this many the line starts to read as a second navigation.
// Truncating keeps the vocabulary's order, which ranks its best terms first.
const MAX_SUGGESTED_SEARCHES = 5

/**
 * When the reader has a whole topic in view and nothing narrowing it — they
 * searched "energy", or they are browsing `?topics=Energy` — offers that
 * topic's curated keywords as a line of links under the search bar, so they can
 * fork into a part of it without having to guess what we have.
 *
 * Never for a query that merely relates to a topic (see findWholeTopicInView):
 * an ambiguous query like "food" or "gdp" spans several topics, and keywords
 * drawn from one of them would silently pick an island for the reader. That
 * fork is between topics, and the topic-page recommendations serve it.
 */
export const SearchTopicKeywordLinks = ({
    allTopics,
    eligibleRegionNames,
}: {
    allTopics: string[]
    eligibleRegionNames: string[]
}): ReactElement | null => {
    const {
        state,
        actions: { setTopicAndQuery },
        templateConfig,
        synonymMap,
        analytics,
    } = useSearchContext()
    const { query, filters } = state

    const topicName = useMemo(
        () => findWholeTopicInView(query, filters, allTopics, synonymMap),
        [query, filters, allTopics, synonymMap]
    )

    // The keywords are drawn from the charts inside a topic, so they narrow a
    // list of data and say nothing about the articles. On the writing tab they
    // would send the reader somewhere the tab can't follow.
    const isApplicable =
        !!topicName && templateConfig.resultType !== SearchResultType.WRITING

    // The vocabulary is ~230 KB, so it is only fetched once the gate above has
    // fired — most searches never request it.
    const { data: vocabulary } = useQuery({
        queryKey: searchQueryKeys.topicVocabulary,
        queryFn: fetchTopicVocabulary,
        enabled: isApplicable,
        staleTime: Infinity,
    })

    // Memoized because checking each keyword runs the same country detection
    // as a search, and this re-renders with everything on the search page.
    const keywords = useMemo(
        () =>
            isApplicable
                ? R.take(
                      suggestedKeywords(
                          topicName,
                          vocabulary?.[topicName]
                      ).filter(
                          // A keyword that contains a country's name, like
                          // "guinea worm", would have that word turned into a
                          // country filter on the way to the URL, so the link
                          // would search for something other than what it says.
                          (keyword) =>
                              isQueryKeptAsTyped(
                                  state,
                                  keyword,
                                  eligibleRegionNames,
                                  synonymMap
                              )
                      ),
                      MAX_SUGGESTED_SEARCHES
                  )
                : [],
        [
            isApplicable,
            topicName,
            vocabulary,
            state,
            eligibleRegionNames,
            synonymMap,
        ]
    )

    if (!isApplicable || !keywords.length) return null

    return (
        <div
            className="search-topic-keyword-links"
            data-testid="search-topic-keyword-links"
        >
            <span className="search-topic-keyword-links__label">
                Refine search:
            </span>{" "}
            {keywords.map((keyword, index) => (
                <Fragment key={keyword}>
                    {index > 0 && ", "}
                    <button
                        type="button"
                        // Keeping the topic as a filter is what makes this a
                        // fork rather than a trapdoor: 105 of the vocabulary's
                        // 728 keywords belong to more than one topic ("deaths"
                        // to sixteen of them), so dropping the topic would
                        // throw the reader back out to the ambiguity the link
                        // just resolved. The filter stays visible and
                        // removable, so they can.
                        onClick={() => {
                            analytics.logSiteClick(
                                "search-topic-keyword-link",
                                // `<1-indexed position>:<topic>:<keyword>`
                                [index + 1, topicName, keyword].join(":")
                            )
                            setTopicAndQuery(topicName, keyword)
                        }}
                        className="search-topic-keyword-links__link"
                    >
                        {keyword}
                    </button>
                </Fragment>
            ))}
        </div>
    )
}
