import { useContext, useState } from "react"
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
import {
    AllChartsBlock,
    AllChartsBlockSkeleton,
} from "../../blocks/AllChartsBlock.js"
import {
    allChartsBlockQueryKeys,
    endsWithPartialCountryName,
    queryAllChartsBlock,
} from "../../search/queries.js"
import { getLiteSearchClient } from "../../search/searchClients.js"
import { buildSearchHref } from "../../search/searchState.js"

const ALL_CHARTS_PREFETCH_ROOT_MARGIN = "100% 0px"

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
    const firstTagSlug = firstTag?.slug
    const topics = tags.map((tag) => tag.name)

    const { ref, isIntersecting } = useIntersectionObserver({
        rootMargin: ALL_CHARTS_PREFETCH_ROOT_MARGIN,
        freezeOnceVisible: true,
    })

    const [query, setQuery] = useState("")
    const [debouncedQuery, setDebouncedQuery] = useDebounceValue(
        query,
        SEARCH_DEBOUNCE_MS
    )
    const requestedQuery = debouncedQuery.trim()

    const chartsQuery = { topics, query: requestedQuery }
    const {
        data,
        isError,
        hasNextPage,
        isFetchingNextPage,
        isFetchNextPageError,
        fetchNextPage,
    } = useInfiniteQuery({
        queryKey: allChartsBlockQueryKeys.charts(chartsQuery),
        queryFn:
            topics.length > 0 && isIntersecting
                ? ({ pageParam }) =>
                      queryAllChartsBlock(getLiteSearchClient(), {
                          ...chartsQuery,
                          page: pageParam,
                      })
                : skipToken,
        placeholderData: keepPreviousData,
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, nbPages } = lastPage
            return page < nbPages - 1 ? page + 1 : undefined
        },
    })

    const [lastDataWithHits, setLastDataWithHits] = useState(data)
    if (data !== lastDataWithHits && data?.pages[0]?.nbHits)
        setLastDataWithHits(data)

    const isWaitingForCountryName =
        data?.pages[0]?.nbHits === 0 &&
        lastDataWithHits !== undefined &&
        endsWithPartialCountryName(data.pages[0].query)
    const shownData = isWaitingForCountryName ? lastDataWithHits : data

    const { data: suggestionKeywords } = useQuery({
        queryKey: allChartsBlockQueryKeys.suggestions(firstTagSlug ?? ""),
        queryFn:
            firstTagSlug && isIntersecting
                ? () => fetchTopicSuggestions(firstTagSlug)
                : skipToken,
        staleTime: Infinity,
    })

    if (!firstTag) return null

    const onQueryChange = (nextQuery: string): void => {
        setQuery(nextQuery)
        if (nextQuery.trim() !== "") return
        setDebouncedQuery("")
        setDebouncedQuery.flush()
    }

    const onSuggestionSelect = (term: string): void => {
        setQuery(term)
        setDebouncedQuery(term)
        setDebouncedQuery.flush()
    }

    const heading = `${getTopicPageHeading("allCharts", gdocType)} on ${sentenceCaseIfNotTopicPage(firstTag.name, gdocType, false)}`

    if (!data && requestedQuery === "") {
        if (!isError)
            return (
                <AllChartsBlockSkeleton
                    ref={ref}
                    className={className}
                    id={id}
                    heading={heading}
                />
            )
        return (
            <AllChartsBlock
                className={className}
                id={id}
                heading={heading}
                hits={[]}
                countries={[]}
                searchStatus="error"
                noResultsHref={buildSearchHref({
                    resultType: SearchResultType.DATA,
                    topic: firstTag.name,
                })}
            />
        )
    }

    const firstPage = shownData?.pages[0]
    const fetchedQuery = firstPage?.query ?? requestedQuery

    return (
        <AllChartsBlock
            className={className}
            id={id}
            heading={heading}
            hitCount={firstPage?.nbHits}
            hits={(shownData?.pages ?? []).flatMap((page) => page.hits)}
            countries={firstPage?.countries ?? []}
            searchStatus={data ? undefined : isError ? "error" : "pending"}
            search={{
                query,
                fetchedQuery,
                onQueryChange,
                suggestedTerms: pickVisibleSuggestions(
                    suggestionKeywords ?? [],
                    query
                ),
                isLoadingSuggestions: suggestionKeywords === undefined,
                onSuggestionSelect,
            }}
            onLoadMore={
                hasNextPage && !isFetchNextPageError && !isWaitingForCountryName
                    ? () => {
                          if (!isFetchingNextPage) void fetchNextPage()
                      }
                    : undefined
            }
            isLoadingMore={isFetchingNextPage}
            noResultsHref={buildSearchHref({
                resultType: SearchResultType.DATA,
                query: fetchedQuery,
            })}
        />
    )
}

async function fetchTopicSuggestions(topicSlug: string): Promise<string[]> {
    try {
        const vocabulary =
            await fetchJson<Partial<Record<string, { keywords: string[] }>>>(
                TOPIC_VOCABULARY_URL
            )
        return vocabulary[topicSlug]?.keywords ?? []
    } catch {
        return []
    }
}

function pickVisibleSuggestions(keywords: string[], query: string): string[] {
    const normalizedQuery = query.trim().toLowerCase()
    return keywords
        .filter((keyword) => keyword.toLowerCase() !== normalizedQuery)
        .slice(0, MAX_SUGGESTIONS)
}
