import { useContext } from "react"
import { skipToken, useInfiniteQuery } from "@tanstack/react-query"
import { useIntersectionObserver } from "usehooks-ts"
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
import { buildSearchHrefForCard } from "../../search/searchState.js"

const ALL_CHARTS_PREFETCH_ROOT_MARGIN = "100% 0px"

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

    const chartsQuery = { topic: topic ?? "", query: "", countries: [] }
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
                searchHref={buildSearchHrefForCard(
                    SearchResultType.DATA,
                    topic
                )}
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
    if (rows.length === 0) return null

    return (
        <AllChartsBlock
            className={className}
            id={id}
            heading={heading}
            rowCount={data.pages[0].nbHits}
            rows={rows}
            onLoadMore={
                hasNextPage && !isFetchNextPageError
                    ? () => {
                          if (!isFetchingNextPage) void fetchNextPage()
                      }
                    : undefined
            }
        />
    )
}

function parseHighlightedText(highlighted: string): TextPart[] {
    return getHighlightedParts(unescape(highlighted)).map((part) => ({
        text: part.value,
        isMatched: part.isHighlighted,
    }))
}
