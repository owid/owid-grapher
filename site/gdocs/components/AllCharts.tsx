import { useContext, useMemo, useState } from "react"
import cx from "clsx"
import * as R from "remeda"
import {
    keepPreviousData,
    skipToken,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query"
import { useDebounceCallback, useIntersectionObserver } from "usehooks-ts"
import {
    ALL_CHARTS_ID,
    fetchJson,
    getTopicPageHeading,
    getUserCountryInformation,
    listedRegionsNames,
    sentenceCaseIfNotTopicPage,
} from "@ourworldindata/utils"
import {
    SearchResultType,
    type BakedAllChartsBlockResults,
    type MinimalTag,
} from "@ourworldindata/types"
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
import {
    buildSearchHref,
    parseAllChartsBlockQuery,
} from "../../search/searchState.js"

type TopicVocabulary = Partial<Record<string, { keywords: string[] }>>

const TOPIC_VOCABULARY_URL =
    "https://files.ourworldindata.org/topic_vocabulary.json"
const MAX_SUGGESTIONS = 6
const COUNTRY_SUGGESTION_INDEX = 2
const MIN_CHARTS_FOR_SUGGESTIONS = 10

const SEARCH_DEBOUNCE_MS = 200

export function AllCharts({
    className,
    id = ALL_CHARTS_ID,
}: {
    className?: string
    id?: string
}) {
    const { tags, allChartsBlockResults } = useContext(AttachmentsContext)
    if (tags.length === 0) return null
    return (
        <AllChartsBlock
            className={className}
            id={id}
            firstTag={tags[0]}
            topics={tags.map((tag) => tag.name)}
            allChartsBlockResults={allChartsBlockResults}
        />
    )
}

function AllChartsBlock({
    className,
    id,
    firstTag,
    topics,
    allChartsBlockResults,
}: {
    className?: string
    id: string
    firstTag: MinimalTag
    topics: string[]
    allChartsBlockResults?: BakedAllChartsBlockResults
}) {
    const { gdocType } = useDocumentContext()

    const { ref, isIntersecting } = useIntersectionObserver({
        rootMargin: "100% 0px",
        freezeOnceVisible: true,
    })

    const [query, setQuery] = useState("")
    const [requestedQuery, setRequestedQuery] = useState("")
    const requestQueryDebounced = useDebounceCallback(
        setRequestedQuery,
        SEARCH_DEBOUNCE_MS
    )
    const parsedQuery = useMemo(
        () => parseAllChartsBlockQuery(requestedQuery),
        [requestedQuery]
    )
    const shouldFetch = isIntersecting
    const isDefaultQuery =
        parsedQuery.textQuery === "" && parsedQuery.countries.length === 0
    const bakedResults = isDefaultQuery ? allChartsBlockResults : undefined
    const shouldShowSuggestions =
        (allChartsBlockResults?.page.nbHits ?? Infinity) >=
        MIN_CHARTS_FOR_SUGGESTIONS
    const shouldFetchSuggestions = shouldFetch && shouldShowSuggestions

    const { data, isError, hasNextPage, isFetchingNextPage, fetchNextPage } =
        useInfiniteQuery({
            queryKey: allChartsBlockQueryKeys.charts(topics, parsedQuery),
            queryFn: shouldFetch
                ? ({ pageParam }) =>
                      queryAllChartsBlock(
                          getLiteSearchClient(),
                          topics,
                          parsedQuery,
                          pageParam
                      )
                : skipToken,
            placeholderData: keepPreviousData,
            initialData: bakedResults && {
                pages: [bakedResults.page],
                pageParams: [0],
            },
            initialDataUpdatedAt: bakedResults?.fetchedAtMs,
            ...(bakedResults && { staleTime: Infinity }),
            initialPageParam: 0,
            getNextPageParam: (lastPage) => {
                return lastPage.page < lastPage.nbPages - 1
                    ? lastPage.page + 1
                    : undefined
            },
        })

    const { data: topicSuggestions, isPending: isLoadingVocabulary } = useQuery(
        {
            queryKey: allChartsBlockQueryKeys.topicVocabulary(),
            queryFn: shouldFetchSuggestions
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
            queryFn: shouldFetchSuggestions
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
        requestQueryDebounced.cancel()
        setQuery(nextQuery)
        setRequestedQuery(nextQuery.trim())
    }

    const onQueryChange = (nextQuery: string): void => {
        if (nextQuery.trim() === "") return applyQuery(nextQuery)
        setQuery(nextQuery)
        requestQueryDebounced(nextQuery.trim())
    }

    const heading = `${getTopicPageHeading("allCharts", gdocType)} on ${sentenceCaseIfNotTopicPage(firstTag.name, gdocType, false)}`

    const firstPage = data?.pages[0]
    const fetchedQuery = firstPage?.query ?? requestedQuery
    const noResultsHref = buildSearchHref(
        fetchedQuery
            ? { resultType: SearchResultType.DATA, query: fetchedQuery }
            : { resultType: SearchResultType.DATA, topic: firstTag.name }
    )
    const hits = data?.pages.flatMap((page) => page.hits) ?? []
    const searchStatus = data ? undefined : isError ? "error" : "pending"
    const suggestedTerms = pickSuggestions({
        keywords: topicSuggestions?.keywords ?? [],
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
                hitCount={firstPage?.nbHits}
            />
            <AllChartsBlockSearch
                query={query}
                onQueryChange={onQueryChange}
                suggestedTerms={suggestedTerms}
                isLoadingSuggestions={
                    shouldShowSuggestions &&
                    (isLoadingVocabulary || isLoadingUserCountry)
                }
                onSuggestionSelect={(term) =>
                    applyQuery(mergeTermIntoQuery(query, term))
                }
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
    detectedCountryName,
    query,
}: {
    keywords: string[]
    detectedCountryName?: string
    query: string
}): string[] {
    const { textQuery, countries } = parseAllChartsBlockQuery(query)
    const normalizedText = textQuery.trim().toLowerCase()
    const keywordPool = keywords.filter(
        (term) => term.toLowerCase() !== normalizedText
    )
    const isCountryInQuery = countries.some(
        (country) =>
            country.toLowerCase() === detectedCountryName?.toLowerCase()
    )
    if (!detectedCountryName || isCountryInQuery)
        return keywordPool.slice(0, MAX_SUGGESTIONS)

    const shownKeywords = keywordPool.slice(0, MAX_SUGGESTIONS - 1)
    return [
        ...shownKeywords.slice(0, COUNTRY_SUGGESTION_INDEX),
        detectedCountryName,
        ...shownKeywords.slice(COUNTRY_SUGGESTION_INDEX),
    ]
}

function mergeTermIntoQuery(currentInput: string, term: string): string {
    const current = parseAllChartsBlockQuery(currentInput)
    const clicked = parseAllChartsBlockQuery(term)
    const countries = R.uniqueBy(
        [...current.countries, ...clicked.countries],
        (country) => country.toLowerCase()
    )
    const textQuery = clicked.textQuery || current.textQuery
    return [...countries, textQuery].filter(Boolean).join(" ")
}
