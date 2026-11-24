import { useContext, useState } from "react"
import cx from "clsx"
import * as R from "remeda"
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
    getUserCountryInformation,
    listedRegionsNames,
    sentenceCaseIfNotTopicPage,
} from "@ourworldindata/utils"
import { SearchResultType, type MinimalTag } from "@ourworldindata/types"
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

type TopicVocabulary = Partial<
    Record<string, { keywords: string[]; countries?: string[] }>
>

const TOPIC_VOCABULARY_URL =
    "https://files.ourworldindata.org/topic_vocabulary.json"
const SUGGESTION_SLOTS = [
    "keyword",
    "keyword",
    "country",
    "keyword",
    "country",
    "keyword",
] as const

const SEARCH_DEBOUNCE_MS = 200

export function AllCharts({
    className,
    id = ALL_CHARTS_ID,
}: {
    className?: string
    id?: string
}) {
    const { tags } = useContext(AttachmentsContext)
    if (tags.length === 0) return null
    return (
        <AllChartsBlock
            className={className}
            id={id}
            firstTag={tags[0]}
            topics={tags.map((tag) => tag.name)}
        />
    )
}

function AllChartsBlock({
    className,
    id,
    firstTag,
    topics,
}: {
    className?: string
    id: string
    firstTag: MinimalTag
    topics: string[]
}) {
    const { gdocType } = useDocumentContext()

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
    const shouldFetch = isIntersecting

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

    const { data: topicSuggestions, isPending: isLoadingVocabulary } = useQuery(
        {
            queryKey: allChartsBlockQueryKeys.topicVocabulary(),
            queryFn: shouldFetch
                ? () => fetchJson<TopicVocabulary>(TOPIC_VOCABULARY_URL)
                : skipToken,
            select: (vocabulary) =>
                firstTag.slug ? vocabulary[firstTag.slug] : undefined,
            staleTime: Infinity,
            retry: false,
        }
    )

    const { data: detectedCountryName, isPending: isLoadingUserCountry } =
        useQuery({
            queryKey: allChartsBlockQueryKeys.userCountry(),
            queryFn: shouldFetch
                ? async () => {
                      const name = (await getUserCountryInformation())?.name
                      return name && listedRegionsNames().includes(name)
                          ? name
                          : null
                  }
                : skipToken,
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
    const suggestedTerms = pickSuggestions({
        keywords: topicSuggestions?.keywords ?? [],
        countries: topicSuggestions?.countries ?? [],
        detectedCountryName: detectedCountryName ?? undefined,
        query,
    })
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
                isLoadingSuggestions={
                    isLoadingVocabulary || isLoadingUserCountry
                }
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

function pickSuggestions({
    keywords,
    countries,
    detectedCountryName,
    query,
}: {
    keywords: string[]
    countries: string[]
    detectedCountryName?: string
    query: string
}): string[] {
    const normalizedQuery = query.trim().toLowerCase()
    const pools = {
        keyword: dedupeAndDropQuery(keywords, normalizedQuery),
        country: dedupeAndDropQuery(
            detectedCountryName
                ? [detectedCountryName, ...countries]
                : countries,
            normalizedQuery
        ),
    }
    if (pools.country.length === 0)
        return pools.keyword.slice(0, SUGGESTION_SLOTS.length)

    const nextIndexes = { keyword: 0, country: 0 }

    return SUGGESTION_SLOTS.map(
        (slot) => pools[slot][nextIndexes[slot]++]
    ).filter(R.isDefined)
}

function dedupeAndDropQuery(
    terms: string[],
    normalizedQuery: string
): string[] {
    return R.uniqueBy(terms, (term) => term.toLowerCase()).filter(
        (term) => term.toLowerCase() !== normalizedQuery
    )
}
