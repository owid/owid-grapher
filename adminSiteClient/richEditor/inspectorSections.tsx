import { Button, Checkbox, Form, Input, Select, Space, Typography } from "antd"
import {
    BlockSize,
    EnrichedBlockKeyIndicator,
    EnrichedBlockPerson,
    EnrichedBlockResearchAndWritingLink,
    EnrichedBlockResearchAndWritingRow,
    EnrichedBlockSimpleText,
    EnrichedBlockText,
    EnrichedChartRowItem,
    EnrichedChartStoryItem,
    EnrichedHybridLink,
    EnrichedSocialLink,
    SocialLinkType,
    blockAlignments,
    exploreDataSectionAlignments,
    pullChartAlignments,
    resourcePanelIcons,
} from "@ourworldindata/types"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"
import {
    ChartUrlField,
    HybridLinksField,
    ImageFilenameField,
    ListField,
    RnwLinksField,
    StringListTextArea,
    isPlainTextSpans,
    plainStringToTextBlocks,
    textBlocksArePlain,
    textBlocksToPlainString,
} from "./inspectorFields.js"
import { InspectedBlock } from "./inspection.js"

// Typed inspector sections for the block types added after the first editor
// milestones, plus the previously-JSON-only aspects of older ones (research
// & writing rows, pill-row pills, key-insight slides). Each section renders
// form fields bound to the inspected block's props; anything not covered
// here stays editable via the Advanced (JSON) editor in BlockInspector.

export interface SectionProps {
    draft: Record<string, unknown>
    apply: (updates: Record<string, unknown>) => void
}

function selectOptions(values: readonly string[]): { value: string }[] {
    return values.map((value) => ({ value }))
}

export function JsonOnlyHint(props: { what: string }): React.ReactElement {
    return (
        <Typography.Paragraph type="secondary">
            {props.what} {props.what.endsWith("s") ? "are" : "is"} edited via
            Advanced (JSON) below.
        </Typography.Paragraph>
    )
}

export function NoSettingsNote(): React.ReactElement {
    return (
        <Typography.Paragraph type="secondary">
            This block has no settings — the site fills it in automatically.
        </Typography.Paragraph>
    )
}

export function CanvasContentNote(): React.ReactElement {
    return (
        <Typography.Paragraph type="secondary">
            The block’s contents are edited directly in the canvas.
        </Typography.Paragraph>
    )
}

// ── containers ──────────────────────────────────────────────────────────────

export function ExpanderSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Title">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Subtitle (optional)">
                <Input
                    value={String(draft.subtitle ?? "")}
                    onChange={(event) =>
                        apply({ subtitle: event.target.value })
                    }
                />
            </Form.Item>
            <Form.Item label="Section heading above (optional)">
                <Input
                    value={String(draft.heading ?? "")}
                    onChange={(event) => apply({ heading: event.target.value })}
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function AlignSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Alignment">
                <Select
                    value={String(draft.alignment ?? "left")}
                    onChange={(alignment) => apply({ alignment })}
                    options={selectOptions(blockAlignments)}
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function DataCalloutSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Chart">
                <ChartUrlField
                    value={String(draft.url ?? "")}
                    onChange={(url) => apply({ url })}
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function ExploreDataSectionSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Title (optional)">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Alignment">
                <Select
                    value={String(draft.align ?? "left")}
                    onChange={(align) => apply({ align })}
                    options={selectOptions(exploreDataSectionAlignments)}
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function ConditionalSectionSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Show only on profiles including">
                <StringListTextArea
                    value={(draft.include ?? []) as string[]}
                    onChange={(include) => apply({ include })}
                    placeholder="One entity per line"
                />
            </Form.Item>
            <Form.Item label="Hide on profiles including">
                <StringListTextArea
                    value={(draft.exclude ?? []) as string[]}
                    onChange={(exclude) => apply({ exclude })}
                    placeholder="One entity per line"
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function TopicPageIntroSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    const downloadButton = draft.downloadButton as
        | { text: string; url: string; type: string }
        | undefined
    const relatedTopics = (draft.relatedTopics ?? []) as {
        text?: string
        url: string
        type: string
    }[]
    return (
        <>
            <Form.Item label="Download button (optional)">
                {downloadButton ? (
                    <Space orientation="vertical" style={{ width: "100%" }}>
                        <Input
                            size="small"
                            placeholder="Button text"
                            value={downloadButton.text}
                            onChange={(event) =>
                                apply({
                                    downloadButton: {
                                        ...downloadButton,
                                        text: event.target.value,
                                    },
                                })
                            }
                        />
                        <Input
                            size="small"
                            placeholder="URL"
                            value={downloadButton.url}
                            onChange={(event) =>
                                apply({
                                    downloadButton: {
                                        ...downloadButton,
                                        url: event.target.value,
                                    },
                                })
                            }
                        />
                        <Button
                            size="small"
                            onClick={() => apply({ downloadButton: undefined })}
                        >
                            Remove button
                        </Button>
                    </Space>
                ) : (
                    <Button
                        size="small"
                        onClick={() =>
                            apply({
                                downloadButton: {
                                    text: "Download all data on this topic",
                                    url: "",
                                    type: "topic-page-intro-download-button",
                                },
                            })
                        }
                    >
                        + Add download button
                    </Button>
                )}
            </Form.Item>
            <Form.Item label="Related topics">
                <ListField<{ text?: string; url: string; type: string }>
                    items={relatedTopics}
                    onChange={(topics) =>
                        apply({
                            relatedTopics:
                                topics.length > 0 ? topics : undefined,
                        })
                    }
                    makeNew={() => ({
                        url: "",
                        type: "topic-page-intro-related-topic",
                    })}
                    addLabel="Add topic"
                    renderItem={(topic, update) => (
                        <>
                            <Input
                                size="small"
                                placeholder="URL (gdoc or external)"
                                value={topic.url}
                                onChange={(event) =>
                                    update({
                                        ...topic,
                                        url: event.target.value,
                                    })
                                }
                            />
                            <Input
                                size="small"
                                placeholder="Text override (optional)"
                                value={topic.text ?? ""}
                                onChange={(event) =>
                                    update({
                                        ...topic,
                                        text: event.target.value || undefined,
                                    })
                                }
                            />
                        </>
                    )}
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function PullChartSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Chart or page URL">
                <ChartUrlField
                    value={String(draft.url ?? "")}
                    onChange={(url) => apply({ url })}
                />
            </Form.Item>
            <Form.Item label="Image">
                <ImageFilenameField
                    value={String(draft.image ?? "")}
                    onChange={(image) => apply({ image: image ?? "" })}
                />
            </Form.Item>
            <Form.Item label="Alignment">
                <Select
                    allowClear
                    placeholder="default"
                    value={(draft.align ?? undefined) as string}
                    onChange={(align) => apply({ align })}
                    options={selectOptions(pullChartAlignments)}
                />
            </Form.Item>
            <CanvasContentNote />
        </>
    )
}

export function KeyInsightsSection({
    draft,
    apply,
    inspected,
}: SectionProps & { inspected: InspectedBlock }): React.ReactElement {
    return (
        <>
            <Form.Item label="Heading">
                <Input
                    value={String(draft.heading ?? "")}
                    onChange={(event) => apply({ heading: event.target.value })}
                />
            </Form.Item>
            {inspected.keyInsightsCommands && (
                <Button
                    size="small"
                    onClick={inspected.keyInsightsCommands.addSlide}
                >
                    + Add slide
                </Button>
            )}
            <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
                Click a slide’s title bar in the canvas to edit its settings;
                slide content is edited directly in the canvas.
            </Typography.Paragraph>
        </>
    )
}

export function KeyInsightSlideSection({
    draft,
    apply,
    inspected,
}: SectionProps & { inspected: InspectedBlock }): React.ReactElement {
    const commands = inspected.keyInsightsCommands
    return (
        <>
            <Form.Item label="Slide title">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Chart (optional)">
                <ChartUrlField
                    value={String(draft.url ?? "")}
                    onChange={(url) => apply({ url: url || undefined })}
                />
            </Form.Item>
            <Form.Item label="Narrative chart name (optional)">
                <Input
                    value={String(draft.narrativeChartName ?? "")}
                    onChange={(event) =>
                        apply({
                            narrativeChartName: event.target.value || undefined,
                        })
                    }
                />
            </Form.Item>
            <Form.Item label="Image (optional)">
                <ImageFilenameField
                    value={String(draft.filename ?? "")}
                    onChange={(filename) => apply({ filename })}
                    allowClear
                />
            </Form.Item>
            {commands && (
                <Form.Item label="Slide">
                    <Space wrap>
                        <Button size="small" onClick={commands.addSlide}>
                            + Add below
                        </Button>
                        {commands.moveUp && (
                            <Button size="small" onClick={commands.moveUp}>
                                ↑ Move up
                            </Button>
                        )}
                        {commands.moveDown && (
                            <Button size="small" onClick={commands.moveDown}>
                                ↓ Move down
                            </Button>
                        )}
                    </Space>
                </Form.Item>
            )}
            <CanvasContentNote />
        </>
    )
}

// ── atoms ───────────────────────────────────────────────────────────────────

export function HtmlSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="HTML">
            <Input.TextArea
                className="rich-editor-inspector__json"
                autoSize={{ minRows: 6, maxRows: 24 }}
                value={String(draft.value ?? "")}
                onChange={(event) => apply({ value: event.target.value })}
            />
        </Form.Item>
    )
}

export function CodeSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    const lines = (draft.text ?? []) as EnrichedBlockSimpleText[]
    return (
        <Form.Item label="Code">
            <Input.TextArea
                className="rich-editor-inspector__json"
                autoSize={{ minRows: 6, maxRows: 24 }}
                value={lines.map((line) => line.value.text).join("\n")}
                onChange={(event) =>
                    apply({
                        text: event.target.value.split("\n").map(
                            (line): EnrichedBlockSimpleText => ({
                                type: "simple-text",
                                value: {
                                    spanType: "span-simple-text",
                                    text: line,
                                },
                                parseErrors: [],
                            })
                        ),
                    })
                }
            />
        </Form.Item>
    )
}

export function StaticVizSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Name">
                <Input
                    value={String(draft.name ?? "")}
                    onChange={(event) => apply({ name: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Size">
                <Select
                    value={String(draft.size ?? "wide")}
                    onChange={(size) => apply({ size })}
                    options={[{ value: "narrow" }, { value: "wide" }]}
                />
            </Form.Item>
            <Checkbox
                checked={Boolean(draft.hasOutline)}
                onChange={(event) =>
                    apply({ hasOutline: event.target.checked })
                }
            >
                Outline
            </Checkbox>
        </>
    )
}

export function ResourcePanelSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Title">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Kicker (optional)">
                <Input
                    value={String(draft.kicker ?? "")}
                    onChange={(event) => apply({ kicker: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Icon (optional)">
                <Select
                    allowClear
                    placeholder="none"
                    value={(draft.icon ?? undefined) as string}
                    onChange={(icon) => apply({ icon })}
                    options={selectOptions(resourcePanelIcons)}
                />
            </Form.Item>
            <Form.Item label="Links">
                <HybridLinksField
                    value={(draft.links ?? []) as EnrichedHybridLink[]}
                    onChange={(links) => apply({ links })}
                />
            </Form.Item>
            <Form.Item label="“Show more” button text (optional)">
                <Input
                    value={String(draft.buttonText ?? "")}
                    onChange={(event) =>
                        apply({ buttonText: event.target.value })
                    }
                />
            </Form.Item>
        </>
    )
}

export function EntrySummarySection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="Entries">
            <ListField<{ text: string; slug: string }>
                items={(draft.items ?? []) as { text: string; slug: string }[]}
                onChange={(items) => apply({ items })}
                makeNew={() => ({ text: "", slug: "" })}
                addLabel="Add entry"
                renderItem={(item, update) => (
                    <>
                        <Input
                            size="small"
                            placeholder="Text"
                            value={item.text}
                            onChange={(event) =>
                                update({ ...item, text: event.target.value })
                            }
                        />
                        <Input
                            size="small"
                            placeholder="Heading slug (e.g. key-insights)"
                            value={item.slug}
                            onChange={(event) =>
                                update({ ...item, slug: event.target.value })
                            }
                        />
                    </>
                )}
            />
        </Form.Item>
    )
}

export function SdgGridSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="Goals">
            <ListField<{ goal: string; link: string }>
                items={(draft.items ?? []) as { goal: string; link: string }[]}
                onChange={(items) => apply({ items })}
                makeNew={() => ({ goal: "", link: "" })}
                addLabel="Add goal"
                renderItem={(item, update) => (
                    <>
                        <Input
                            size="small"
                            placeholder="Goal"
                            value={item.goal}
                            onChange={(event) =>
                                update({ ...item, goal: event.target.value })
                            }
                        />
                        <Input
                            size="small"
                            placeholder="Link"
                            value={item.link}
                            onChange={(event) =>
                                update({ ...item, link: event.target.value })
                            }
                        />
                    </>
                )}
            />
        </Form.Item>
    )
}

export function SocialsSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="Links">
            <ListField<EnrichedSocialLink>
                items={(draft.links ?? []) as EnrichedSocialLink[]}
                onChange={(links) => apply({ links })}
                makeNew={() => ({ text: "", url: "", parseErrors: [] })}
                addLabel="Add link"
                renderItem={(link, update) => (
                    <>
                        <Input
                            size="small"
                            placeholder="Text (e.g. @ourworldindata)"
                            value={link.text}
                            onChange={(event) =>
                                update({ ...link, text: event.target.value })
                            }
                        />
                        <Input
                            size="small"
                            placeholder="URL"
                            value={link.url}
                            onChange={(event) =>
                                update({ ...link, url: event.target.value })
                            }
                        />
                        <Select
                            size="small"
                            allowClear
                            placeholder="Platform"
                            value={link.type}
                            onChange={(type) =>
                                update({
                                    ...link,
                                    type: type as SocialLinkType | undefined,
                                })
                            }
                            options={Object.values(SocialLinkType).map(
                                (value) => ({ value })
                            )}
                        />
                    </>
                )}
            />
        </Form.Item>
    )
}

export function HomepageIntroSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    type FeaturedWork = {
        url: string
        title?: string
        kicker?: string
        isNew?: boolean
    }
    return (
        <Form.Item label="Featured work">
            <ListField<FeaturedWork>
                items={(draft.featuredWork ?? []) as FeaturedWork[]}
                onChange={(featuredWork) => apply({ featuredWork })}
                makeNew={() => ({ url: "" })}
                addLabel="Add work"
                renderItem={(work, update) => (
                    <>
                        <Input
                            size="small"
                            placeholder="URL (gdoc or external)"
                            value={work.url}
                            onChange={(event) =>
                                update({ ...work, url: event.target.value })
                            }
                        />
                        <Input
                            size="small"
                            placeholder="Title override (optional)"
                            value={work.title ?? ""}
                            onChange={(event) =>
                                update({
                                    ...work,
                                    title: event.target.value || undefined,
                                })
                            }
                        />
                        <Checkbox
                            checked={Boolean(work.isNew)}
                            onChange={(event) =>
                                update({
                                    ...work,
                                    isNew: event.target.checked || undefined,
                                })
                            }
                        >
                            “New” badge
                        </Checkbox>
                    </>
                )}
            />
        </Form.Item>
    )
}

export function CountryProfileSelectorSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Profile base URL">
                <Input
                    value={String(draft.url ?? "")}
                    placeholder="https://ourworldindata.org/co2-country-profile"
                    onChange={(event) => apply({ url: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Title (optional)">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Description (optional)">
                <Input.TextArea
                    autoSize
                    value={String(draft.description ?? "")}
                    onChange={(event) =>
                        apply({ description: event.target.value })
                    }
                />
            </Form.Item>
            <Form.Item label="Default countries">
                <StringListTextArea
                    value={(draft.defaultCountries ?? []) as string[]}
                    onChange={(defaultCountries) => apply({ defaultCountries })}
                    placeholder="One country per line"
                />
            </Form.Item>
        </>
    )
}

export function SubscribeBannerSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="Alignment">
            <Select
                value={String(draft.align ?? "left")}
                onChange={(align) => apply({ align })}
                options={selectOptions(blockAlignments)}
            />
        </Form.Item>
    )
}

export function BespokeComponentSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Bundle">
                <Input
                    value={String(draft.bundle ?? "")}
                    onChange={(event) => apply({ bundle: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Variant (optional)">
                <Input
                    value={String(draft.variant ?? "")}
                    onChange={(event) => apply({ variant: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Size">
                <Select
                    value={String(draft.size ?? "wide")}
                    onChange={(size) => apply({ size })}
                    options={[
                        { value: "narrow" },
                        { value: "wide" },
                        { value: "widest" },
                    ]}
                />
            </Form.Item>
            <JsonOnlyHint what="The component’s config" />
        </>
    )
}

/**
 * Plain-text editor for nested text blocks, offered only while every span is
 * plain so formatting can never be silently destroyed.
 */
function GuardedTextBlocksField(props: {
    value: EnrichedBlockText[]
    onChange: (blocks: EnrichedBlockText[]) => void
    jsonHint: string
}): React.ReactElement {
    if (!textBlocksArePlain(props.value)) {
        return <JsonOnlyHint what={props.jsonHint} />
    }
    return (
        <Input.TextArea
            autoSize
            value={textBlocksToPlainString(props.value)}
            placeholder="One paragraph per line"
            onChange={(event) =>
                props.onChange(plainStringToTextBlocks(event.target.value))
            }
        />
    )
}

export function ChartStorySection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="Story steps">
            <ListField<EnrichedChartStoryItem>
                items={(draft.items ?? []) as EnrichedChartStoryItem[]}
                onChange={(items) => apply({ items })}
                makeNew={() => ({
                    narrative: { type: "text", value: [], parseErrors: [] },
                    chart: {
                        type: "chart",
                        url: "",
                        size: BlockSize.Wide,
                        parseErrors: [],
                    },
                    technical: [],
                })}
                addLabel="Add step"
                renderItem={(item, update) => (
                    <>
                        <ChartUrlField
                            value={item.chart?.url ?? ""}
                            onChange={(url) =>
                                update({
                                    ...item,
                                    chart: { ...item.chart, url },
                                })
                            }
                        />
                        {isPlainTextSpans(item.narrative?.value) ? (
                            <Input.TextArea
                                size="small"
                                autoSize
                                placeholder="Narrative text"
                                value={spansToUnformattedPlainText(
                                    item.narrative?.value ?? []
                                )}
                                onChange={(event) =>
                                    update({
                                        ...item,
                                        narrative: {
                                            type: "text",
                                            value: event.target.value
                                                ? [
                                                      {
                                                          spanType:
                                                              "span-simple-text",
                                                          text: event.target
                                                              .value,
                                                      },
                                                  ]
                                                : [],
                                            parseErrors: [],
                                        },
                                    })
                                }
                            />
                        ) : (
                            <JsonOnlyHint what="This step’s formatted narrative" />
                        )}
                        <GuardedTextBlocksField
                            value={item.technical ?? []}
                            onChange={(technical) =>
                                update({ ...item, technical })
                            }
                            jsonHint="This step’s technical notes"
                        />
                    </>
                )}
            />
        </Form.Item>
    )
}

export function ChartRowsSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Kicker">
                <Input
                    value={String(draft.kicker ?? "")}
                    onChange={(event) => apply({ kicker: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Title">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Source line">
                <Input
                    value={String(draft.source ?? "")}
                    onChange={(event) => apply({ source: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Rows">
                <ListField<EnrichedChartRowItem>
                    items={(draft.rows ?? []) as EnrichedChartRowItem[]}
                    onChange={(rows) => apply({ rows })}
                    makeNew={() => ({ image: "", url: "", content: [] })}
                    addLabel="Add row"
                    renderItem={(row, update) => (
                        <>
                            <Input
                                size="small"
                                placeholder="Image filename"
                                value={row.image}
                                onChange={(event) =>
                                    update({
                                        ...row,
                                        image: event.target.value,
                                    })
                                }
                            />
                            <Input
                                size="small"
                                placeholder="Link URL"
                                value={row.url}
                                onChange={(event) =>
                                    update({ ...row, url: event.target.value })
                                }
                            />
                            <GuardedTextBlocksField
                                value={row.content ?? []}
                                onChange={(content) =>
                                    update({ ...row, content })
                                }
                                jsonHint="This row’s formatted text"
                            />
                        </>
                    )}
                />
            </Form.Item>
        </>
    )
}

function PersonFields(props: {
    person: Omit<EnrichedBlockPerson, "type" | "parseErrors">
    update: (person: Omit<EnrichedBlockPerson, "type" | "parseErrors">) => void
}): React.ReactElement {
    const { person, update } = props
    return (
        <>
            <Input
                size="small"
                placeholder="Name"
                value={person.name}
                onChange={(event) =>
                    update({ ...person, name: event.target.value })
                }
            />
            <Input
                size="small"
                placeholder="Role/title (optional)"
                value={person.title ?? ""}
                onChange={(event) =>
                    update({
                        ...person,
                        title: event.target.value || undefined,
                    })
                }
            />
            <Input
                size="small"
                placeholder="Image filename (optional)"
                value={person.image ?? ""}
                onChange={(event) =>
                    update({
                        ...person,
                        image: event.target.value || undefined,
                    })
                }
            />
            <GuardedTextBlocksField
                value={person.text ?? []}
                onChange={(text) => update({ ...person, text })}
                jsonHint="This person’s formatted bio"
            />
        </>
    )
}

function makeNewPerson(): EnrichedBlockPerson {
    return { type: "person", name: "", text: [], parseErrors: [] }
}

export function PersonSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <PersonFields
                person={
                    draft as unknown as Omit<
                        EnrichedBlockPerson,
                        "type" | "parseErrors"
                    >
                }
                update={(person) => apply(person as Record<string, unknown>)}
            />
            <JsonOnlyHint what="The social links list" />
        </>
    )
}

export function PeopleSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="People">
            <ListField<EnrichedBlockPerson>
                items={(draft.items ?? []) as EnrichedBlockPerson[]}
                onChange={(items) => apply({ items })}
                makeNew={makeNewPerson}
                addLabel="Add person"
                renderItem={(person, update) => (
                    <PersonFields
                        person={person}
                        update={(updated) => update({ ...person, ...updated })}
                    />
                )}
            />
        </Form.Item>
    )
}

export function PeopleRowsSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Columns">
                <Select
                    value={String(draft.columns ?? "4")}
                    onChange={(columns) => apply({ columns })}
                    options={[{ value: "2" }, { value: "4" }]}
                />
            </Form.Item>
            <Form.Item label="People">
                <ListField<EnrichedBlockPerson>
                    items={(draft.people ?? []) as EnrichedBlockPerson[]}
                    onChange={(people) => apply({ people })}
                    makeNew={makeNewPerson}
                    addLabel="Add person"
                    renderItem={(person, update) => (
                        <PersonFields
                            person={person}
                            update={(updated) =>
                                update({ ...person, ...updated })
                            }
                        />
                    )}
                />
            </Form.Item>
        </>
    )
}

export function KeyIndicatorSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Data page URL">
                <Input
                    value={String(draft.datapageUrl ?? "")}
                    placeholder="https://ourworldindata.org/grapher/…"
                    onChange={(event) =>
                        apply({ datapageUrl: event.target.value })
                    }
                />
            </Form.Item>
            <Form.Item label="Title">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Source (optional)">
                <Input
                    value={String(draft.source ?? "")}
                    onChange={(event) => apply({ source: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Text">
                <GuardedTextBlocksField
                    value={(draft.text ?? []) as EnrichedBlockText[]}
                    onChange={(text) => apply({ text })}
                    jsonHint="The indicator’s formatted text"
                />
            </Form.Item>
        </>
    )
}

export function KeyIndicatorCollectionSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    const indicators = (draft.blocks ?? []) as EnrichedBlockKeyIndicator[]
    const button = draft.button as { text: string; url: string } | undefined
    return (
        <>
            <Form.Item label="Heading (optional)">
                <Input
                    value={String(draft.heading ?? "")}
                    onChange={(event) => apply({ heading: event.target.value })}
                />
            </Form.Item>
            <Form.Item label="Subtitle (optional)">
                <Input
                    value={String(draft.subtitle ?? "")}
                    onChange={(event) =>
                        apply({ subtitle: event.target.value })
                    }
                />
            </Form.Item>
            <Form.Item label="Button (optional)">
                <Space orientation="vertical" style={{ width: "100%" }}>
                    <Input
                        size="small"
                        placeholder="Button text"
                        value={button?.text ?? ""}
                        onChange={(event) =>
                            apply({
                                button: event.target.value
                                    ? {
                                          text: event.target.value,
                                          url: button?.url ?? "",
                                      }
                                    : undefined,
                            })
                        }
                    />
                    <Input
                        size="small"
                        placeholder="Button URL"
                        value={button?.url ?? ""}
                        onChange={(event) =>
                            apply({
                                button: {
                                    text: button?.text ?? "",
                                    url: event.target.value,
                                },
                            })
                        }
                    />
                </Space>
            </Form.Item>
            <Form.Item label="Indicators">
                <ListField<EnrichedBlockKeyIndicator>
                    items={indicators}
                    onChange={(blocks) => apply({ blocks })}
                    makeNew={() => ({
                        type: "key-indicator",
                        datapageUrl: "",
                        title: "",
                        text: [],
                        parseErrors: [],
                    })}
                    addLabel="Add indicator"
                    renderItem={(indicator, update) => (
                        <>
                            <Input
                                size="small"
                                placeholder="Data page URL"
                                value={indicator.datapageUrl}
                                onChange={(event) =>
                                    update({
                                        ...indicator,
                                        datapageUrl: event.target.value,
                                    })
                                }
                            />
                            <Input
                                size="small"
                                placeholder="Title"
                                value={indicator.title}
                                onChange={(event) =>
                                    update({
                                        ...indicator,
                                        title: event.target.value,
                                    })
                                }
                            />
                            <GuardedTextBlocksField
                                value={indicator.text ?? []}
                                onChange={(text) =>
                                    update({ ...indicator, text })
                                }
                                jsonHint="This indicator’s formatted text"
                            />
                        </>
                    )}
                />
            </Form.Item>
        </>
    )
}

export function LtpTocSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <>
            <Form.Item label="Title (optional)">
                <Input
                    value={String(draft.title ?? "")}
                    onChange={(event) => apply({ title: event.target.value })}
                />
            </Form.Item>
            <Typography.Paragraph type="secondary">
                The table of contents itself is generated from the page’s
                headings.
            </Typography.Paragraph>
        </>
    )
}

// ── previously-JSON-only aspects of older blocks ────────────────────────────

/** The row sections, "more" row and "latest" section of research & writing */
export function ResearchAndWritingExtrasSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    const rows = (draft.rows ?? []) as EnrichedBlockResearchAndWritingRow[]
    const more = draft.more as EnrichedBlockResearchAndWritingRow | undefined
    const latest = draft.latest as { heading?: string } | undefined
    return (
        <>
            <Form.Item label="Row sections">
                <ListField<EnrichedBlockResearchAndWritingRow>
                    items={rows}
                    onChange={(next) => apply({ rows: next })}
                    makeNew={() => ({ heading: "", articles: [] })}
                    addLabel="Add row section"
                    renderItem={(row, update) => (
                        <>
                            <Input
                                size="small"
                                placeholder="Section heading"
                                value={row.heading}
                                onChange={(event) =>
                                    update({
                                        ...row,
                                        heading: event.target.value,
                                    })
                                }
                            />
                            <RnwLinksField
                                value={row.articles}
                                onChange={(articles) =>
                                    update({ ...row, articles })
                                }
                            />
                        </>
                    )}
                />
            </Form.Item>
            <Form.Item label="“More” section (optional)">
                {more ? (
                    <Space orientation="vertical" style={{ width: "100%" }}>
                        <Input
                            size="small"
                            placeholder="Heading (e.g. More on this topic)"
                            value={more.heading}
                            onChange={(event) =>
                                apply({
                                    more: {
                                        ...more,
                                        heading: event.target.value,
                                    },
                                })
                            }
                        />
                        <RnwLinksField
                            value={more.articles}
                            onChange={(
                                articles: EnrichedBlockResearchAndWritingLink[]
                            ) => apply({ more: { ...more, articles } })}
                        />
                        <Button
                            size="small"
                            onClick={() => apply({ more: undefined })}
                        >
                            Remove “more” section
                        </Button>
                    </Space>
                ) : (
                    <Button
                        size="small"
                        onClick={() =>
                            apply({ more: { heading: "More", articles: [] } })
                        }
                    >
                        + Add “more” section
                    </Button>
                )}
            </Form.Item>
            <Form.Item label="“Latest work” section (optional)">
                {latest ? (
                    <Space orientation="vertical" style={{ width: "100%" }}>
                        <Input
                            size="small"
                            placeholder="Heading override (optional)"
                            value={latest.heading ?? ""}
                            onChange={(event) =>
                                apply({
                                    latest: {
                                        ...latest,
                                        heading:
                                            event.target.value || undefined,
                                    },
                                })
                            }
                        />
                        <Typography.Text type="secondary">
                            Articles are filled in automatically with the latest
                            work on this topic.
                        </Typography.Text>
                        <Button
                            size="small"
                            onClick={() => apply({ latest: undefined })}
                        >
                            Remove “latest” section
                        </Button>
                    </Space>
                ) : (
                    <Button size="small" onClick={() => apply({ latest: {} })}>
                        + Add “latest work” section
                    </Button>
                )}
            </Form.Item>
        </>
    )
}

/** The pills of a pill row (text + url) */
export function PillRowPillsSection({
    draft,
    apply,
}: SectionProps): React.ReactElement {
    return (
        <Form.Item label="Pills">
            <ListField<{ text?: string; url: string }>
                items={(draft.pills ?? []) as { text?: string; url: string }[]}
                onChange={(pills) => apply({ pills })}
                makeNew={() => ({ url: "" })}
                addLabel="Add pill"
                renderItem={(pill, update) => (
                    <>
                        <Input
                            size="small"
                            placeholder="URL (gdoc or external)"
                            value={pill.url}
                            onChange={(event) =>
                                update({ ...pill, url: event.target.value })
                            }
                        />
                        <Input
                            size="small"
                            placeholder="Text (optional for gdocs)"
                            value={pill.text ?? ""}
                            onChange={(event) =>
                                update({
                                    ...pill,
                                    text: event.target.value || undefined,
                                })
                            }
                        />
                    </>
                )}
            />
        </Form.Item>
    )
}
