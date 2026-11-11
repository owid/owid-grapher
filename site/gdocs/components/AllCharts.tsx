import { useContext, useState } from "react"
import {
    keepPreviousData,
    skipToken,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query"
import { useDebounceValue, useIntersectionObserver } from "usehooks-ts"
import {
    getHighlightedParts,
    unescape,
} from "instantsearch.js/es/lib/utils/index.js"
import {
    EnrichedBlockAllCharts,
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
    AllChartsBlockError,
    AllChartsBlockSkeleton,
} from "../../blocks/AllChartsBlock.js"
import { AllChartsRowData, TextPart } from "../../blocks/AllChartsRow.js"
import {
    allChartsBlockQueryKeys,
    queryAllChartsBlock,
} from "../../search/queries.js"
import { getLiteSearchClient } from "../../search/searchClients.js"
import { buildSearchHref } from "../../search/searchState.js"

const ALL_CHARTS_PREFETCH_ROOT_MARGIN = "100% 0px"

const TOPIC_VOCABULARY_URL =
    "https://files.ourworldindata.org/topic_vocabulary.json"
const MAX_SUGGESTIONS = 5

const SEARCH_DEBOUNCE_MS = 200

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
    id?: string
}

export function AllCharts({ className, id = ALL_CHARTS_ID }: AllChartsProps) {
    const { tags } = useContext(AttachmentsContext)
    const { gdocType } = useDocumentContext()
    const topic = tags[0]?.name
    const topicSlug = tags[0]?.slug

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

    const chartsQuery = {
        topic: topic ?? "",
        query: requestedQuery,
    }
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
            topic && isIntersecting
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

    const { data: suggestionKeywords } = useQuery({
        queryKey: allChartsBlockQueryKeys.suggestions(topicSlug ?? ""),
        queryFn:
            topicSlug && isIntersecting
                ? () => fetchTopicSuggestions(topicSlug)
                : skipToken,
        staleTime: Infinity,
    })

    if (!topic) return null

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

    const heading = `${getTopicPageHeading("allCharts", gdocType)} on ${sentenceCaseIfNotTopicPage(topic, gdocType, false)}`

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
            <AllChartsBlockError
                className={className}
                id={id}
                heading={heading}
                searchHref={buildSearchHref({
                    resultType: SearchResultType.DATA,
                    topic,
                })}
            />
        )
    }

    const rows = (data?.pages ?? []).flatMap((page) =>
        page.hits.map((hit): AllChartsRowData => ({
            type: hit.type,
            slug: hit.slug,
            titleParts: parseHighlightedText(
                hit._highlightResult?.title?.value ?? hit.title
            ),
            variantName: hit.variantName,
            source: hit.source,
            availableTabs: hit.availableTabs,
        }))
    )
    const firstPage = data?.pages[0]
    const fetchedQuery = firstPage?.query ?? requestedQuery

    return (
        <AllChartsBlock
            className={className}
            id={id}
            heading={heading}
            rowCount={firstPage?.nbHits}
            rows={rows}
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
                hasNextPage && !isFetchNextPageError
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

function parseHighlightedText(highlighted: string): TextPart[] {
    return getHighlightedParts(unescape(highlighted)).map((part) => ({
        text: part.value,
        isMatched: part.isHighlighted,
    }))
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
