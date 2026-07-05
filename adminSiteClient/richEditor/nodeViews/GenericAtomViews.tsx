import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import {
    EnrichedBlockChartStory,
    EnrichedBlockCode,
    EnrichedBlockKeyIndicator,
    EnrichedBlockKeyIndicatorCollection,
    EnrichedBlockPeopleRows,
    EnrichedBlockPerson,
    EnrichedBlockResourcePanel,
    EnrichedBlockSocials,
} from "@ourworldindata/types"
import { BlockFrame } from "./BlockFrame.js"

// NodeViews for the long tail of props-atom blocks added after the first
// editor milestones. All share one card chrome; a factory keeps the
// per-type code down to a summary line and an optional card body.

function getBlockProps(props: NodeViewProps): Record<string, unknown> {
    return (props.node.attrs.props ?? {}) as Record<string, unknown>
}

function AtomCard(viewProps: {
    nodeViewProps: NodeViewProps
    blockType: string
    summary?: string
    children?: React.ReactNode
}): React.ReactElement {
    const { nodeViewProps, blockType, summary, children } = viewProps
    return (
        <NodeViewWrapper
            className={`rich-atom-block rich-atom-block--${blockType}${
                nodeViewProps.selected ? " rich-block--selected" : ""
            }`}
        >
            <BlockFrame
                nodeViewProps={nodeViewProps}
                label={blockType}
                summary={summary}
            />
            <div contentEditable={false}>{children}</div>
        </NodeViewWrapper>
    )
}

/**
 * Card view for an atom block: label chip + summary, optional body. The
 * block's settings are edited in the right rail once selected.
 */
function createAtomCardView(
    blockType: string,
    options: {
        summarize?: (props: Record<string, unknown>) => string | undefined
        body?: (props: Record<string, unknown>) => React.ReactNode
    } = {}
): (props: NodeViewProps) => React.ReactElement {
    function AtomCardView(props: NodeViewProps): React.ReactElement {
        const blockProps = getBlockProps(props)
        return (
            <AtomCard
                nodeViewProps={props}
                blockType={blockType}
                summary={options.summarize?.(blockProps)}
            >
                <div className="rich-atom-block__card">
                    {options.body ? (
                        options.body(blockProps)
                    ) : (
                        <strong>{blockType}</strong>
                    )}
                </div>
            </AtomCard>
        )
    }
    AtomCardView.displayName = `AtomCardView(${blockType})`
    return AtomCardView
}

/** Placeholder card for atoms without settings (site-generated sections) */
function createPlaceholderAtomView(
    blockType: string,
    description: string
): (props: NodeViewProps) => React.ReactElement {
    return createAtomCardView(blockType, {
        body: () => (
            <>
                <strong>{blockType}</strong>
                <p>{description}</p>
            </>
        ),
    })
}

function truncate(text: string, length: number): string {
    return text.length > length ? `${text.slice(0, length)}…` : text
}

export function HtmlBlockView(props: NodeViewProps): React.ReactElement {
    const value = String(getBlockProps(props).value ?? "")
    return (
        <AtomCard
            nodeViewProps={props}
            blockType="html"
            summary={`${value.length} chars`}
        >
            {/* shown as source, not rendered: arbitrary markup would run
                scripts inside the admin */}
            <pre className="rich-atom-block__code">
                {truncate(value, 2000) || "Empty — edit in the right rail"}
            </pre>
        </AtomCard>
    )
}

export function CodeBlockView(props: NodeViewProps): React.ReactElement {
    const lines = (getBlockProps(props) as unknown as EnrichedBlockCode).text
    const value = (lines ?? []).map((line) => line.value.text).join("\n")
    return (
        <AtomCard
            nodeViewProps={props}
            blockType="code"
            summary={`${lines?.length ?? 0} lines`}
        >
            <pre className="rich-atom-block__code">
                {truncate(value, 2000) || "Empty — edit in the right rail"}
            </pre>
        </AtomCard>
    )
}

export const StaticVizBlockView = createAtomCardView("static-viz", {
    summarize: (props) => String(props.name ?? ""),
    body: (props) => (
        <>
            <strong>Static visualization</strong>
            <p>{String(props.name ?? "") || "No name set"}</p>
        </>
    ),
})

export const ResourcePanelBlockView = createAtomCardView("resource-panel", {
    summarize: (props) => String(props.title ?? ""),
    body: (props) => {
        const panel = props as unknown as Omit<
            EnrichedBlockResourcePanel,
            "type"
        >
        return (
            <>
                <strong>{panel.title || "Resource panel"}</strong>
                <ul>
                    {(panel.links ?? []).map((link, index) => (
                        <li key={index}>{link.title || link.url}</li>
                    ))}
                </ul>
            </>
        )
    },
})

export const EntrySummaryBlockView = createAtomCardView("entry-summary", {
    summarize: (props) =>
        `${(props.items as unknown[] | undefined)?.length ?? 0} entries`,
    body: (props) => (
        <>
            <strong>Entry summary</strong>
            <ul>
                {((props.items ?? []) as { text: string }[]).map(
                    (item, index) => (
                        <li key={index}>{item.text}</li>
                    )
                )}
            </ul>
        </>
    ),
})

export const SdgGridBlockView = createAtomCardView("sdg-grid", {
    summarize: (props) =>
        `${(props.items as unknown[] | undefined)?.length ?? 0} goals`,
    body: (props) => (
        <>
            <strong>SDG grid</strong>
            <ul>
                {((props.items ?? []) as { goal: string }[]).map(
                    (item, index) => (
                        <li key={index}>{item.goal}</li>
                    )
                )}
            </ul>
        </>
    ),
})

export const AdditionalChartsBlockView = createAtomCardView(
    "additional-charts",
    {
        summarize: (props) =>
            `${(props.items as unknown[] | undefined)?.length ?? 0} charts`,
        body: () => (
            <>
                <strong>Additional charts</strong>
                <p>Chart links list; edit in the right rail</p>
            </>
        ),
    }
)

export const SocialsBlockView = createAtomCardView("socials", {
    summarize: (props) =>
        `${(props.links as unknown[] | undefined)?.length ?? 0} links`,
    body: (props) => {
        const socials = props as unknown as Omit<EnrichedBlockSocials, "type">
        return (
            <>
                <strong>Social links</strong>
                <ul>
                    {(socials.links ?? []).map((link, index) => (
                        <li key={index}>
                            {link.text}
                            {link.type ? ` (${link.type})` : ""}
                        </li>
                    ))}
                </ul>
            </>
        )
    },
})

export const HomepageIntroBlockView = createAtomCardView("homepage-intro", {
    summarize: (props) =>
        `${(props.featuredWork as unknown[] | undefined)?.length ?? 0} featured`,
    body: (props) => (
        <>
            <strong>Homepage intro</strong>
            <ul>
                {((props.featuredWork ?? []) as { url: string; title?: string }[]).map(
                    (work, index) => (
                        <li key={index}>{work.title || work.url}</li>
                    )
                )}
            </ul>
        </>
    ),
})

export const CountryProfileSelectorBlockView = createAtomCardView(
    "country-profile-selector",
    {
        summarize: (props) => String(props.title ?? ""),
        body: (props) => (
            <>
                <strong>{String(props.title ?? "") || "Country profiles"}</strong>
                <p>{String(props.url ?? "")}</p>
            </>
        ),
    }
)

export const SubscribeBannerBlockView = createAtomCardView(
    "subscribe-banner",
    {
        summarize: (props) => `align: ${String(props.align ?? "left")}`,
        body: () => (
            <>
                <strong>Subscribe banner</strong>
                <p>Newsletter subscription call-out</p>
            </>
        ),
    }
)

export const BespokeComponentBlockView = createAtomCardView(
    "bespoke-component",
    {
        summarize: (props) =>
            [props.bundle, props.variant].filter(Boolean).join(" · "),
        body: (props) => (
            <>
                <strong>Bespoke component</strong>
                <p>
                    Bundle: {String(props.bundle ?? "") || "not set"}
                    {props.variant ? ` — variant: ${String(props.variant)}` : ""}
                </p>
            </>
        ),
    }
)

export const ChartStoryBlockView = createAtomCardView("chart-story", {
    summarize: (props) =>
        `${(props.items as unknown[] | undefined)?.length ?? 0} steps`,
    body: (props) => {
        const story = props as unknown as Omit<EnrichedBlockChartStory, "type">
        return (
            <>
                <strong>Chart story</strong>
                <ol>
                    {(story.items ?? []).map((item, index) => (
                        <li key={index}>
                            {truncate(
                                item.chart?.url?.replace(
                                    /^https?:\/\/[^/]+/,
                                    ""
                                ) ?? "",
                                80
                            ) || "no chart"}
                        </li>
                    ))}
                </ol>
            </>
        )
    },
})

export const ChartRowsBlockView = createAtomCardView("chart-rows", {
    summarize: (props) =>
        `${(props.rows as unknown[] | undefined)?.length ?? 0} rows`,
    body: (props) => (
        <>
            <strong>{String(props.title ?? "") || "Chart rows"}</strong>
            {props.kicker ? <p>{String(props.kicker)}</p> : null}
        </>
    ),
})

function personSummary(person: Omit<EnrichedBlockPerson, "type">): string {
    return [person.name, person.title].filter(Boolean).join(" — ")
}

export const PersonBlockView = createAtomCardView("person", {
    summarize: (props) =>
        personSummary(props as unknown as Omit<EnrichedBlockPerson, "type">),
    body: (props) => {
        const person = props as unknown as Omit<EnrichedBlockPerson, "type">
        return (
            <>
                <strong>{person.name || "Unnamed person"}</strong>
                {person.title ? <p>{person.title}</p> : null}
            </>
        )
    },
})

function peopleBody(people: EnrichedBlockPerson[]): React.ReactNode {
    return (
        <ul>
            {people.map((person, index) => (
                <li key={index}>{personSummary(person)}</li>
            ))}
        </ul>
    )
}

export const PeopleBlockView = createAtomCardView("people", {
    summarize: (props) =>
        `${(props.items as unknown[] | undefined)?.length ?? 0} people`,
    body: (props) => (
        <>
            <strong>People</strong>
            {peopleBody((props.items ?? []) as EnrichedBlockPerson[])}
        </>
    ),
})

export const PeopleRowsBlockView = createAtomCardView("people-rows", {
    summarize: (props) => {
        const rows = props as unknown as Omit<EnrichedBlockPeopleRows, "type">
        return `${rows.people?.length ?? 0} people · ${rows.columns ?? "2"} columns`
    },
    body: (props) => (
        <>
            <strong>People rows</strong>
            {peopleBody(
                ((props as unknown as Omit<EnrichedBlockPeopleRows, "type">)
                    .people ?? []) as EnrichedBlockPerson[]
            )}
        </>
    ),
})

export const KeyIndicatorBlockView = createAtomCardView("key-indicator", {
    summarize: (props) => String(props.title ?? ""),
    body: (props) => {
        const indicator = props as unknown as Omit<
            EnrichedBlockKeyIndicator,
            "type"
        >
        return (
            <>
                <strong>{indicator.title || "Key indicator"}</strong>
                <p>{indicator.datapageUrl}</p>
            </>
        )
    },
})

export const KeyIndicatorCollectionBlockView = createAtomCardView(
    "key-indicator-collection",
    {
        summarize: (props) =>
            `${(props.blocks as unknown[] | undefined)?.length ?? 0} indicators`,
        body: (props) => {
            const collection = props as unknown as Omit<
                EnrichedBlockKeyIndicatorCollection,
                "type"
            >
            return (
                <>
                    <strong>
                        {collection.heading || "Key indicator collection"}
                    </strong>
                    <ul>
                        {(collection.blocks ?? []).map((block, index) => (
                            <li key={index}>{block.title}</li>
                        ))}
                    </ul>
                </>
            )
        },
    }
)

export const LtpTocBlockView = createAtomCardView("ltp-toc", {
    summarize: (props) => String(props.title ?? ""),
    body: (props) => (
        <>
            <strong>{String(props.title ?? "") || "Table of contents"}</strong>
            <p>Generated from the page’s headings</p>
        </>
    ),
})

export const SdgTocBlockView = createPlaceholderAtomView(
    "sdg-toc",
    "Table of contents generated from the page’s headings"
)
export const MissingDataBlockView = createPlaceholderAtomView(
    "missing-data",
    "Standard note on missing country data"
)
export const DonorListBlockView = createPlaceholderAtomView(
    "donors",
    "The donor list, generated from the donations database"
)
export const LatestDataInsightsBlockView = createPlaceholderAtomView(
    "latest-data-insights",
    "The most recent data insights, filled in automatically"
)
export const FeaturedDataInsightsBlockView = createPlaceholderAtomView(
    "featured-data-insights",
    "Featured data insights, filled in automatically"
)
export const FeaturedMetricsBlockView = createPlaceholderAtomView(
    "featured-metrics",
    "Featured metrics for this page, managed in the admin"
)
export const HomepageSearchBlockView = createPlaceholderAtomView(
    "homepage-search",
    "The homepage search box"
)
export const CookieNoticeBlockView = createPlaceholderAtomView(
    "cookie-notice",
    "The cookie preferences notice"
)
