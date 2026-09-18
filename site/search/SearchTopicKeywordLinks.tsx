import { Fragment, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { SearchResultType } from "@ourworldindata/types"
import { useSearchContext } from "./SearchContext.js"
import { capSuggestedSearches, findWholeTopicInView } from "./searchUtils.js"
import { fetchTopicVocabulary, suggestedKeywords } from "./topicVocabulary.js"
import { searchQueryKeys } from "./queries.js"
import { TOPIC_VOCABULARY_URL } from "../../settings/clientSettings.js"

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
}: {
    allTopics: string[]
}) => {
    const {
        state: { query, filters },
        actions: { setTopicAndQuery },
        templateConfig,
        synonymMap,
    } = useSearchContext()

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
        queryKey: searchQueryKeys.topicVocabulary(TOPIC_VOCABULARY_URL),
        queryFn: fetchTopicVocabulary,
        enabled: isApplicable,
        staleTime: Infinity,
    })

    const keywords = useMemo(
        () =>
            topicName
                ? capSuggestedSearches(
                      suggestedKeywords(topicName, vocabulary?.[topicName])
                  )
                : [],
        [vocabulary, topicName]
    )

    if (!isApplicable || !topicName || !keywords.length) return null

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
                        onClick={() => setTopicAndQuery(topicName, keyword)}
                        className="search-topic-keyword-links__link"
                    >
                        {keyword}
                    </button>
                </Fragment>
            ))}
        </div>
    )
}
