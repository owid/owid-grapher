import { Component } from "react"
import { observer } from "mobx-react"
import { action } from "mobx"
import { slugify } from "@ourworldindata/utils"
import {
    DbChartTagJoin,
    GrapherInterface,
    MinimalTagWithMetadata,
} from "@ourworldindata/types"
import { ConfigEditor } from "./ConfigEditor.js"
import { AutoTextField, Section, Toggle } from "./Forms.js"
import { TagsSection } from "./EditorBasicTab.js"

interface EditorPublishingTabProps {
    editor: ConfigEditor
    indicatorId: number | undefined
    indicatorConfig: GrapherInterface | undefined
    isInheritanceEnabled: boolean
    onInheritanceChange: (isEnabled: boolean) => void
    tags: DbChartTagJoin[] | undefined
    availableTags: MinimalTagWithMetadata[] | undefined
    onSaveTags: (tags: DbChartTagJoin[]) => Promise<void>
    forceDatapage: boolean
    onForceDatapageChange: (forceDatapage: boolean) => void
}

/**
 * Everything about the chart as a row in our database that isn't its
 * config: inheritance from the indicator, tags, the data-page override
 */
@observer
export class EditorPublishingTab extends Component<EditorPublishingTabProps> {
    override render(): React.ReactElement {
        const { editor, indicatorId, indicatorConfig } = this.props
        const { grapherState } = editor
        return (
            <>
                <Section name="URL">
                    <AutoTextField
                        label="/grapher/"
                        value={grapherState.slug}
                        onValue={action(
                            (slug: string) =>
                                (grapherState.slug = slugify(slug))
                        )}
                        isAuto={grapherState.slug === grapherState.defaultSlug}
                        onToggleAuto={action(
                            () => (grapherState.slug = grapherState.defaultSlug)
                        )}
                        helpText="Human-friendly URL for this chart"
                    />
                </Section>
                <Section name="Inheritance">
                    {indicatorId ? (
                        <>
                            <Toggle
                                label="Inherit settings from the indicator"
                                secondaryLabel="Only your changes are saved; the rest follows the indicator's own config."
                                value={this.props.isInheritanceEnabled}
                                onValue={this.props.onInheritanceChange}
                            />
                            <small className="form-text text-muted">
                                Indicator:{" "}
                                <a
                                    href={`/admin/variables/${indicatorId}`}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    {grapherState.inputTable.get(
                                        String(indicatorId)
                                    )?.name ?? indicatorId}
                                </a>
                                {indicatorConfig
                                    ? ""
                                    : " (has no config of its own yet)"}
                            </small>
                        </>
                    ) : (
                        <p>
                            This chart has no y indicator yet, so there is
                            nothing to inherit from.
                        </p>
                    )}
                </Section>
                <TagsSection
                    chartId={grapherState.id}
                    tags={this.props.tags}
                    availableTags={this.props.availableTags}
                    onSaveTags={this.props.onSaveTags}
                />
                <Section name="Data page">
                    <Toggle
                        label="Force to be a data page"
                        secondaryLabel="Use metadata from the first Y indicator (same behavior as multi-dimensional data pages)."
                        value={this.props.forceDatapage}
                        onValue={this.props.onForceDatapageChange}
                    />
                </Section>
            </>
        )
    }
}
