import { useContext, useState } from "react"
import cx from "clsx"
import {
    keepPreviousData,
    skipToken,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query"
import { useDebounceValue, useIntersectionObserver } from "usehooks-ts"
import {
    ALL_CHARTS_ID,
    fetchJson,
    getTopicPageHeading,
    sentenceCaseIfNotTopicPage,
} from "@ourworldindata/utils"
import { SearchResultType } from "@ourworldindata/types"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { useDocumentContext } from "../DocumentContext.js"
import { AllChartsBlockHeading } from "../../blocks/AllChartsBlockHeading.js"
import { AllChartsBlockSearch } from "../../blocks/AllChartsBlockSearch.js"
import { AllChartsBlockResults } from "../../blocks/AllChartsBlockResults.js"
import {
    allChartsBlockQueryKeys,
    queryAllChartsBlock,
} from "../../search/queries.js"
import { getLiteSearchClient } from "../../search/searchClients.js"
import { buildSearchHref } from "../../search/searchState.js"

type TopicVocabulary = Partial<Record<string, { keywords: string[] }>>

const TOPIC_VOCABULARY_URL =
    "https://files.ourworldindata.org/topic_vocabulary.json"
const MAX_SUGGESTIONS = 5

const SEARCH_DEBOUNCE_MS = 200

export function AllCharts({
    className,
    id = ALL_CHARTS_ID,
}: {
    className?: string
    id?: string
}) {
    const { tags } = useContext(AttachmentsContext)
    const { gdocType } = useDocumentContext()

    const firstTag = tags[0]
    const firstTagSlug = firstTag.slug
    const topics = tags.map((tag) => tag.name)

    const { ref, isIntersecting } = useIntersectionObserver({
        rootMargin: "100% 0px",
        freezeOnceVisible: true,
    })

    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useDebounceValue(
        query,
        SEARCH_DEBOUNCE_MS
    )
    const requestedQuery = debouncedQuery.trim()
    const shouldFetch = topics.length > 0 && isIntersecting

    const { data, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
        useInfiniteQuery({
            queryKey: allChartsBlockQueryKeys.charts(topics, requestedQuery),
            queryFn: shouldFetch
                ? ({ pageParam }) =>
                      queryAllChartsBlock(
                          getLiteSearchClient(),
                          topics,
                          requestedQuery,
                          pageParam
                      )
                : skipToken,
            placeholderData: keepPreviousData,
            initialPageParam: 0,
            getNextPageParam: (lastPage) => {
                const { page = 0, nbPages = 1 } = lastPage.response
                return page < nbPages - 1 ? page + 1 : undefined
            },
        })

    const { data: suggestionKeywords, isPending: isLoadingSuggestions } =
        useQuery({
            queryKey: allChartsBlockQueryKeys.topicVocabulary(),
            queryFn: shouldFetch
                ? () => fetchJson<TopicVocabulary>(TOPIC_VOCABULARY_URL)
                : skipToken,
            select: (vocabulary) =>
                (firstTagSlug && vocabulary[firstTagSlug]?.keywords) || [],
            staleTime: Infinity,
            retry: false,
        })

    const applyQuery = (nextQuery: string): void => {
        setQuery(nextQuery)
        setDebouncedQuery(nextQuery)
        setDebouncedQuery.flush()
    }

    const onQueryChange = (nextQuery: string): void => {
        if (nextQuery.trim() === "") applyQuery(nextQuery)
        else setQuery(nextQuery)
    }

    const heading = `${getTopicPageHeading("allCharts", gdocType)} on ${sentenceCaseIfNotTopicPage(firstTag.name, gdocType, false)}`

    const firstPage = data?.pages[0]
    const fetchedQuery = firstPage?.query ?? requestedQuery
    const noResultsHref = buildSearchHref(
        fetchedQuery
            ? { resultType: SearchResultType.DATA, query: fetchedQuery }
            : { resultType: SearchResultType.DATA, topic: firstTag.name }
    )
    const hits = data?.pages.flatMap((page) => page.response.hits) ?? []
    const searchStatus = data ? undefined : isError ? "error" : "pending"
    const suggestedTerms = pickVisibleSuggestions(
        suggestionKeywords ?? [],
        query
    )
    const onLoadMore = (): void => {
        if (!isFetchingNextPage) void fetchNextPage()
    }

    return (
        <section className={cx(className, "needs-dividers")} ref={ref}>
            <AllChartsBlockHeading
                id={id}
                heading={heading}
                hitCount={firstPage?.response.nbHits}
            />
            <AllChartsBlockSearch
                query={query}
                onQueryChange={onQueryChange}
                suggestedTerms={suggestedTerms}
                isLoadingSuggestions={isLoadingSuggestions}
                onSuggestionSelect={applyQuery}
            />
            <AllChartsBlockResults
                status={searchStatus}
                hits={hits}
                countries={firstPage?.countries ?? []}
                fetchedQuery={fetchedQuery}
                onLoadMore={hasNextPage ? onLoadMore : undefined}
                isLoadingMore={isFetchingNextPage}
                noResultsHref={noResultsHref}
            />
        </section>
    )
}

function pickVisibleSuggestions(keywords: string[], query: string): string[] {
    const normalizedQuery = query.trim().toLowerCase()
    return keywords
        .filter((keyword) => keyword.toLowerCase() !== normalizedQuery)
        .slice(0, MAX_SUGGESTIONS)
}
