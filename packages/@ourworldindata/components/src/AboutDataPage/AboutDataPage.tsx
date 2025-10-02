import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"

export interface AboutDataPageProps {
    chartDescription: string
}

export const AboutDataPage = ({ chartDescription }: AboutDataPageProps) => {
    return (
        <div className="about-page">
            <div className="about-page-callout">
                <div className="about-page-callout__content">
                    <p>
                        We're piloting longer, screen-reader-friendly
                        descriptions of our webpages to make our work easier to
                        use and understand. Everything else on the page works as
                        usual.
                    </p>
                </div>
            </div>

            <div className="about-page-content">
                <ExpandableToggle
                    label="What is this page?"
                    hasTeaser
                    content={
                        <p>
                            This is a "Data Page." It is designed to (1) let you
                            interactively explore an indicator by choosing
                            countries, time ranges, and views; (2) explain
                            definitions, caveats, and methodology; (3) provide
                            clear provenance and processing notes; and (4) make
                            reuse straightforward with one-click downloads,
                            share links, and copy-and-paste citations.
                        </p>
                    }
                />

                <ExpandableToggle
                    label="How is the page structured?"
                    hasTeaser
                    content={
                        <>
                            <p>The page has five main sections:</p>
                            <ul>
                                <li>
                                    <strong>Explore the Data:</strong> An
                                    interactive chart with controls to switch
                                    view (Table/Map, etc.), open Settings,
                                    add/remove countries via a searchable
                                    checklist, scrub or animate a time slider
                                    with Play time-lapse, and share or download
                                    the figure and data.
                                </li>
                                <li>
                                    <strong>
                                        What you should know about this
                                        indicator:
                                    </strong>{" "}
                                    Short guidance on meaning and interpretation
                                    with inline links to any relevant
                                    documentation. A side info card lists
                                    Source, Last updated, Date range, and Unit.
                                </li>
                                <li>
                                    <strong>Research & Writing:</strong>{" "}
                                    Clickable cards offer narrative context.
                                </li>
                                <li>
                                    <strong>All Charts:</strong> Additional
                                    interactive chart(s) that reuse this
                                    indicator.
                                </li>
                                <li>
                                    <strong>Sources & Processing:</strong>{" "}
                                    Expandable source entries with "Retrieved
                                    on/from" details, formal citations, and
                                    OWID's processing notes. Includes a link to
                                    Read about OWID's data pipeline.
                                </li>
                                <li>
                                    <strong>Reuse This Work:</strong> Licensing
                                    and citation guidance. Third-party data
                                    follow original terms; OWID text, visuals,
                                    and code are open under CC BY.
                                </li>
                            </ul>
                        </>
                    }
                />

                <ExpandableToggle
                    label="What options are available on the interactive chart?"
                    hasTeaser
                    content={
                        <>
                            <p>
                                On the interactive chart there is a "Download"
                                button in the bottom right. This button opens a
                                modal with two tabs:{" "}
                                <strong>Visualization</strong> and{" "}
                                <strong>Data</strong>.
                            </p>
                            <p>
                                In <strong>Visualization</strong>, a short note
                                explains you can embed an interactive version
                                (live or as a fixed snapshot). Below it are two
                                large choices, each with its own download
                                button: <strong>Image (PNG)</strong> for general
                                use, and <strong>Vector graphic (SVG)</strong>{" "}
                                for high-quality print or editing.
                            </p>
                            <p>
                                In the <strong>Data</strong> tab, there is more
                                information about the Source, and citation
                                instructions with linked sources and brief
                                credit guidance. Here there is a Quick download
                                button for "full data" (all entities and time
                                points) or "displayed data" (exactly what's
                                visible in the chart). There is also a Data API
                                section at the bottom of this modal, which gives
                                you ready-to-copy URLs that return the chart's
                                data as CSV and its rich metadata as JSON.
                            </p>
                            <p>
                                The other button at the bottom right of the
                                interactive chart have a <strong>Share</strong>{" "}
                                icon, which opens a small popover labeled
                                "Share" next to the button. This leads to a
                                compact menu with four options.
                            </p>
                            <ul>
                                <li>
                                    <strong>Embed</strong> opens an overlay with
                                    ready-to-copy <code>&lt;iframe&gt;</code>{" "}
                                    HTML for the interactive chart; the code
                                    preserves your current state (selected
                                    countries/regions, view, and time range) and
                                    will reflect future data updates.
                                </li>
                                <li>
                                    <strong>Share via…</strong> invokes your
                                    device's native share sheet with the same
                                    stateful URL so you can send it to apps or
                                    email.
                                </li>
                                <li>
                                    <strong>Copy link</strong> places that
                                    stateful URL on your clipboard, ensuring
                                    others see exactly the same view.
                                </li>
                                <li>
                                    <strong>Edit</strong> opens the chart in
                                    OWID's Grapher editor—available only to
                                    users with edit access.
                                </li>
                            </ul>
                            <p>
                                The chart also includes a searchable selector to
                                pick countries. You can type to filter or scroll
                                through the list. Each country shows a small
                                horizontal bar of the current metric, so you can
                                sense the distribution while choosing. You can
                                sort by the metric (high→low or low→high), or
                                sort/filter by other attributes (e.g., name or
                                region). Selections apply immediately to the
                                chart.
                            </p>
                        </>
                    }
                />

                <ExpandableToggle
                    label="What does the chart show?"
                    hasTeaser
                    content={<p>{chartDescription}</p>}
                />

                <ExpandableToggle
                    label="Are links stable?"
                    hasTeaser
                    content={
                        <>
                            <p>
                                The URL for this chart changes in a structured
                                way as you interact with the chart. As you
                                change the options in the chart (places, time,
                                view), the page URL updates to encode that exact
                                state, so copying it shares a stable,
                                reproducible view. Three parameters matter most:
                            </p>
                            <ul>
                                <li>
                                    <strong>country=</strong> a tilde-separated
                                    list of entity codes (ISO-3 like DEU, plus
                                    special codes like OWID_WRL for World).
                                </li>
                                <li>
                                    <strong>time=</strong> a range in the form
                                    start..end; you can use specific years or
                                    the keywords earliest and latest.
                                </li>
                                <li>
                                    <strong>tab=</strong> the chart type, e.g.
                                    map, table, or discrete-bar (omit for the
                                    default time-series view).
                                </li>
                            </ul>
                            <p>
                                For example, if you append{" "}
                                <code>
                                    ?tab=line&time=2000..latest&country=~DEU
                                </code>{" "}
                                to the page URL, it will display the line-chart
                                tab, with the series starting in the year 2000
                                and running until the most recent year with
                                available data for Germany.
                            </p>
                        </>
                    }
                />
            </div>
        </div>
    )
}
