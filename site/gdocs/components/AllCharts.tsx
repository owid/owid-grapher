import { useContext, useState } from "react"
import {
    keepPreviousData,
    skipToken,
    useInfiniteQuery,
} from "@tanstack/react-query"
import { useDebounceValue, useIntersectionObserver } from "usehooks-ts"
import {
    getHighlightedParts,
    unescape,
} from "instantsearch.js/es/lib/utils/index.js"
import {
    EnrichedBlockAllCharts,
    ALL_CHARTS_ID,
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

const SEARCH_DEBOUNCE_MS = 200
const SEARCH_PLACEHOLDER =
    "Search indicators by name, keyword, country, or source…"

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
    id?: string
}

export function AllCharts({ className, id = ALL_CHARTS_ID }: AllChartsProps) {
    const { tags } = useContext(AttachmentsContext)
    const { gdocType } = useDocumentContext()
    const topic = tags[0]?.name

    const { ref, isIntersecting } = useIntersectionObserver({
        rootMargin: ALL_CHARTS_PREFETCH_ROOT_MARGIN,
        freezeOnceVisible: true,
    })

    const [query, setQuery] = useState("")
    const [debouncedQuery] = useDebounceValue(query, SEARCH_DEBOUNCE_MS)
    const requestedQuery = query.trim() === "" ? "" : debouncedQuery.trim()

    const chartsQuery = {
        topic: topic ?? "",
        query: requestedQuery,
        countries: [],
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

    if (!topic) return null

    const heading = `${getTopicPageHeading("allCharts", gdocType)} on ${sentenceCaseIfNotTopicPage(topic, gdocType, false)}`

    if (!data) {
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

    const rows = data.pages.flatMap((page) =>
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
    const rowsQuery = data.pages[0].query

    return (
        <AllChartsBlock
            className={className}
            id={id}
            heading={heading}
            rowCount={data.pages[0].nbHits}
            rows={rows}
            search={{
                query,
                rowsQuery,
                onQueryChange: setQuery,
                placeholder: SEARCH_PLACEHOLDER,
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
                query: rowsQuery,
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
