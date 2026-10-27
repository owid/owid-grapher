import { useEffect, useReducer } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight, faXmark } from "@fortawesome/free-solid-svg-icons"
import {
    AI_SEARCH_MODELS,
    AiSearchBlock,
    AiSearchContentBlock,
    AiSearchErrorCode,
    AiSearchEvent,
    AiSearchModel,
} from "@ourworldindata/types"
import { streamAiSearch, useAiSearchSettings } from "./aiSearchClient.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"
import { SearchFlatArticleHit } from "./SearchFlatArticleHit.js"
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
 * The AI search prototype: a results page the model lays out as blocks,
 * rendered with the components standard search uses for the same content.
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

    return (
        <section className="search-ai-results col-start-2 span-cols-12">
            <header className="search-ai-results__header">
                <h2 className="search-ai-results__title">
                    AI search <span className="search-ai-results__beta">Prototype</span>
                </h2>
                <div className="search-ai-results__settings">
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
                    <button
                        type="button"
                        className="search-ai-results__close"
                        aria-label="Close AI search"
                        onClick={onClose}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            </header>

            {state.expansions.length > 0 && (
                <p className="search-ai-results__note">
                    Also searched for: {state.expansions.join(", ")}
                </p>
            )}

            <div className="search-ai-results__blocks">
                {state.blocks.map((block, index) => (
                    <AiBlock
                        key={index}
                        block={block}
                        onSearch={onSearch}
                    />
                ))}
            </div>

            {isStreaming && (
                <div className="search-ai-results__status" aria-live="polite">
                    <span className="search-ai-results__spinner" />
                    {state.status ?? "Starting…"}
                </div>
            )}
            {state.error && (
                <p className="search-ai-results__error">
                    {ERROR_MESSAGES[state.error]}
                </p>
            )}
            {state.done && (
                <p className="search-ai-results__note">
                    {state.done.model} ·{" "}
                    {Object.entries(state.done.timings)
                        .map(([label, ms]) => `${label} ${(ms / 1000).toFixed(1)}s`)
                        .join(" · ")}
                </p>
            )}
            {debug &&
                state.debug.map(({ title, text }, index) => (
                    <details key={index} className="search-ai-results__debug">
                        <summary>{title}</summary>
                        <pre>{text}</pre>
                    </details>
                ))}
            {debug && state.blocks.length > 0 && (
                <details className="search-ai-results__debug">
                    <summary>Resolved blocks</summary>
                    <pre>{JSON.stringify(state.blocks.map(summarizeBlock), null, 2)}</pre>
                </details>
            )}
        </section>
    )
}

function AiBlock({
    block,
    onSearch,
}: {
    block: AiSearchBlock
    onSearch: (query: string) => void
}) {
    switch (block.type) {
        case "group":
            return (
                <section className="search-ai-group">
                    <h3 className="search-ai-group__title">{block.title}</h3>
                    {block.blurb && (
                        <p className="search-ai-group__blurb">{block.blurb}</p>
                    )}
                    {block.blocks.map((child, index) => (
                        <AiContentBlock key={index} block={child} />
                    ))}
                </section>
            )
        case "forks":
            return (
                <section className="search-ai-forks">
                    {block.question && (
                        <h3 className="search-ai-forks__question">
                            {block.question}
                        </h3>
                    )}
                    <div className="search-ai-forks__options">
                        {block.options.map((option) => (
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
                                    {option.query}{" "}
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
                    <h3 className="search-ai-related__title">Related searches</h3>
                    <div className="search-ai-related__queries">
                        {block.queries.map((query) => (
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
        default:
            return <AiContentBlock block={block} />
    }
}

// Clicks aren't tracked yet
const noop = (): void => undefined

function AiContentBlock({ block }: { block: AiSearchContentBlock }) {
    switch (block.type) {
        case "chart":
            return (
                <div className="search-data-results__hit">
                    <SearchChartHitComponent
                        hit={block.hit}
                        variant={block.size}
                        selectedRegionNames={
                            block.country ? [block.country] : undefined
                        }
                        onClick={noop}
                    />
                </div>
            )
        case "topicPage":
            return (
                <SearchTopicPageHit
                    className="search-ai-results__page"
                    hit={block.hit}
                    variant="large"
                    onClick={noop}
                />
            )
        case "article":
            return (
                <SearchFlatArticleHit
                    className="search-ai-results__page"
                    hit={block.hit}
                    onClick={noop}
                />
            )
        case "dataInsight":
            return (
                <SearchDataInsightHit
                    className="search-ai-results__page search-ai-results__insight"
                    hit={block.hit}
                    onClick={noop}
                />
            )
    }
}

/** A block with hits reduced to their slugs, for the debug output */
function summarizeBlock(block: AiSearchBlock): unknown {
    if (block.type === "group")
        return { ...block, blocks: block.blocks.map(summarizeBlock) }
    if ("hit" in block) return { ...block, hit: block.hit.slug }
    return block
}
