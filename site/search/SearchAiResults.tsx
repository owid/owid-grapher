import { useEffect, useReducer } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight, faXmark } from "@fortawesome/free-solid-svg-icons"
import {
    AI_SEARCH_MODELS,
    AiSearchBlock,
    AiSearchChartBlock,
    AiSearchContentBlock,
    AiSearchErrorCode,
    AiSearchEvent,
    AiSearchModel,
} from "@ourworldindata/types"
import { streamAiSearch, useAiSearchSettings } from "./aiSearchClient.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail.js"
import { SearchChartHitMediumSkeleton } from "./SearchDataTopicsResultsSkeleton.js"
import {
    constructChartUrl,
    constructPreviewUrl,
    toGrapherQueryParams,
} from "./searchUtils.js"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"
import { SearchStackedArticleHit } from "./SearchStackedArticleHit.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"

interface AiSearchState {
    status?: string
    expansions: string[]
    blocks: AiSearchBlock[]
    debug: { title: string; text: string }[]
    done?: { model: string; timings: Record<string, number> }
    error?: AiSearchErrorCode
}

const INITIAL_STATE: AiSearchState = { expansions: [], blocks: [], debug: [] }

function reducer(
    state: AiSearchState,
    event: AiSearchEvent | { type: "reset" }
): AiSearchState {
    switch (event.type) {
        case "reset":
            return INITIAL_STATE
        case "status":
            return { ...state, status: event.text }
        case "expansion":
            return { ...state, expansions: event.queries }
        case "block":
            return { ...state, blocks: [...state.blocks, event.block] }
        case "debug":
            return { ...state, debug: [...state.debug, event] }
        case "done":
            return { ...state, done: event, status: undefined }
        case "error":
            return { ...state, error: event.code, status: undefined }
    }
}

const ERROR_MESSAGES: Record<AiSearchErrorCode, string> = {
    unavailable: "AI search isn't available on this server.",
    no_candidates: "We couldn't find any charts or articles for this search.",
    rate_limited: "AI search is busy right now. Please try again in a minute.",
    refused: "The model declined to answer this search.",
    no_blocks: "The model didn't return a usable layout.",
    failed: "Something went wrong.",
}

/**
 * The AI search prototype: an overview page the model lays out as blocks,
 * rendered with the components standard search uses for the same content.
 * Charts the model shows large or medium get the rich cards of standard
 * search; everything else is shown as rows of cards.
 */
export function SearchAiResults({
    query,
    onSearch,
    onClose,
}: {
    query: string
    // Runs AI search for a fork option or a related search
    onSearch: (query: string) => void
    onClose: () => void
}) {
    const [settings, updateSettings] = useAiSearchSettings()
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
    const { model, debug } = settings

    useEffect(() => {
        const controller = new AbortController()
        dispatch({ type: "reset" })
        streamAiSearch({
            query,
            settings: { model, debug },
            signal: controller.signal,
            onEvent: dispatch,
        }).catch(() => {
            if (!controller.signal.aborted)
                dispatch({ type: "error", code: "failed" })
        })
        return () => controller.abort()
    }, [query, model, debug])

    const isStreaming = !state.done && !state.error
    const items = toLayoutItems(state.blocks)

    return (
        <section className="search-ai col-start-2 span-cols-12">
            <header className="search-ai__header">
                <div className="search-ai__label">
                    AI overview
                    <span className="search-ai__badge">Prototype</span>
                </div>
                <details className="search-ai__settings">
                    <summary>Settings</summary>
                    <div className="search-ai__settings-body">
                        <select
                            aria-label="Model"
                            value={model}
                            onChange={(e) =>
                                updateSettings({
                                    model: e.target.value as AiSearchModel,
                                })
                            }
                        >
                            {AI_SEARCH_MODELS.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        <label>
                            <input
                                type="checkbox"
                                checked={debug}
                                onChange={(e) =>
                                    updateSettings({ debug: e.target.checked })
                                }
                            />{" "}
                            Debug
                        </label>
                    </div>
                </details>
                <button
                    type="button"
                    className="search-ai__close"
                    aria-label="Close AI overview"
                    onClick={onClose}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </header>

            {items.map((item, index) => (
                <AiLayoutItem key={index} item={item} onSearch={onSearch} />
            ))}

            {isStreaming && (
                <div className="search-ai__loading" aria-live="polite">
                    <p className="search-ai__status">
                        {state.status ?? "Starting…"}
                    </p>
                    {state.blocks.length === 0 && (
                        <div className="animate-pulse">
                            <SearchChartHitMediumSkeleton />
                        </div>
                    )}
                </div>
            )}
            {state.error && (
                <p className="search-ai__error">
                    {ERROR_MESSAGES[state.error]}
                </p>
            )}

            {debug && (
                <div className="search-ai__debug">
                    {state.expansions.length > 0 && (
                        <p>Also searched for: {state.expansions.join(", ")}</p>
                    )}
                    {state.done && (
                        <p>
                            {state.done.model} ·{" "}
                            {Object.entries(state.done.timings)
                                .map(
                                    ([label, ms]) =>
                                        `${label} ${(ms / 1000).toFixed(1)}s`
                                )
                                .join(" · ")}
                        </p>
                    )}
                    {state.debug.map(({ title, text }, index) => (
                        <details key={index}>
                            <summary>{title}</summary>
                            <pre>{text}</pre>
                        </details>
                    ))}
                    {state.blocks.length > 0 && (
                        <details>
                            <summary>Resolved blocks</summary>
                            <pre>
                                {JSON.stringify(
                                    state.blocks.map(summarizeBlock),
                                    null,
                                    2
                                )}
                            </pre>
                        </details>
                    )}
                </div>
            )}
        </section>
    )
}

type LayoutItem =
    | Exclude<AiSearchBlock, AiSearchContentBlock>
    | AiSearchChartBlock
    | { type: "topicPage"; block: AiSearchContentBlock }
    | { type: "cards"; blocks: AiSearchContentBlock[] }

/**
 * Turns the block list into what the page shows: large and medium charts and
 * topic pages get a row of their own, and runs of other content (small
 * charts, articles, data insights) become rows of cards
 */
function toLayoutItems(blocks: AiSearchBlock[]): LayoutItem[] {
    const items: LayoutItem[] = []
    for (const block of blocks) {
        const isCard =
            (block.type === "chart" && block.size === "small") ||
            block.type === "article" ||
            block.type === "dataInsight"
        const last = items.at(-1)
        if (isCard && last?.type === "cards") last.blocks.push(block)
        else if (isCard) items.push({ type: "cards", blocks: [block] })
        else if (block.type === "topicPage")
            items.push({ type: "topicPage", block })
        else items.push(block)
    }
    return items
}

function AiLayoutItem({
    item,
    onSearch,
}: {
    item: LayoutItem
    onSearch: (query: string) => void
}) {
    switch (item.type) {
        case "chart":
            return (
                <div className="search-ai__wide-chart">
                    <SearchChartHitComponent
                        hit={item.hit}
                        variant={item.size}
                        selectedRegionNames={
                            item.country ? [item.country] : undefined
                        }
                        onClick={noop}
                    />
                </div>
            )
        case "topicPage":
            return (
                <div className="search-ai__topic-page">
                    <AiCard block={item.block} />
                </div>
            )
        case "cards":
            return <AiCards blocks={item.blocks} />
        case "group":
            return (
                <section className="search-ai-group">
                    <h3 className="search-ai-group__title">{item.title}</h3>
                    {item.blurb && (
                        <p className="search-ai-group__blurb">{item.blurb}</p>
                    )}
                    <AiCards blocks={item.blocks} />
                </section>
            )
        case "forks":
            return (
                <section className="search-ai-forks">
                    {item.question && (
                        <h3 className="search-ai-forks__question">
                            {item.question}
                        </h3>
                    )}
                    <div className="search-ai-forks__options">
                        {item.options.map((option) => (
                            <button
                                key={option.query}
                                type="button"
                                className="search-ai-forks__option"
                                onClick={() => onSearch(option.query)}
                            >
                                <span className="search-ai-forks__label">
                                    {option.label}
                                </span>
                                <span className="search-ai-forks__query">
                                    Search “{option.query}”{" "}
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )
        case "related":
            return (
                <section className="search-ai-related">
                    <h3 className="search-ai-related__title">
                        Related searches
                    </h3>
                    <div className="search-ai-related__queries">
                        {item.queries.map((query) => (
                            <button
                                key={query}
                                type="button"
                                className="search-ai-related__query"
                                onClick={() => onSearch(query)}
                            >
                                {query}
                            </button>
                        ))}
                    </div>
                </section>
            )
    }
}

function AiCards({ blocks }: { blocks: AiSearchContentBlock[] }) {
    return (
        <div className="search-ai__cards">
            {blocks.map((block) => (
                <AiCard key={block.hit.objectID} block={block} />
            ))}
        </div>
    )
}

// Clicks aren't tracked yet
const noop = (): void => undefined

function AiCard({ block }: { block: AiSearchContentBlock }) {
    switch (block.type) {
        case "chart":
            return <AiChartCard block={block} />
        case "topicPage":
            return <SearchTopicPageHit hit={block.hit} onClick={noop} />
        case "article":
            return (
                <SearchStackedArticleHit
                    hit={{ ...block.hit, excerpt: block.hit.excerpt ?? "" }}
                    onClick={noop}
                />
            )
        case "dataInsight":
            return <SearchDataInsightHit hit={block.hit} onClick={noop} />
    }
}

/** A chart thumbnail with its title, for rows of cards */
function AiChartCard({ block }: { block: AiSearchChartBlock }) {
    const { hit, country } = block
    // The chart's default view, which its authors picked
    const grapherParams = toGrapherQueryParams({
        entities: country ? [country] : [],
    })
    const chartUrl = constructChartUrl({ hit, grapherParams })
    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams,
        variant: PreviewVariant.Thumbnail,
    })
    return (
        <a
            className="search-chart-hit-captioned-link search-ai-chart-card"
            href={chartUrl}
        >
            <SearchChartHitThumbnail
                previewUrl={previewUrl}
                hoverOverlayText="Explore the data"
            />
            <h4 className="search-ai-chart-card__title">
                {hit.title}
                {hit.variantName && (
                    <span className="search-ai-chart-card__variant">
                        {" "}
                        {hit.variantName}
                    </span>
                )}
            </h4>
        </a>
    )
}

/** A block with hits reduced to their slugs, for the debug output */
function summarizeBlock(block: AiSearchBlock): unknown {
    if (block.type === "group")
        return { ...block, blocks: block.blocks.map(summarizeBlock) }
    if ("hit" in block) return { ...block, hit: block.hit.slug }
    return block
}
