import { DbChartTagJoin, TaggableType } from "@ourworldindata/types"
import { Section } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { MinimalTagWithMetadata } from "./TagGraphMetadata.js"

/** The tags of a chart in the admin database; saved on their own, not with the chart. */
export const ChartTagsSection = (props: {
    chartId: number | undefined
    tags: DbChartTagJoin[] | undefined
    availableTags: MinimalTagWithMetadata[] | undefined
    onSaveTags: (tags: DbChartTagJoin[]) => Promise<void>
}) => {
    const { chartId, tags, availableTags } = props
    const canTag = !!chartId && tags && availableTags
    return (
        <Section name="Tags">
            {canTag ? (
                <>
                    <EditableTags
                        onSave={props.onSaveTags}
                        tags={tags}
                        suggestions={availableTags}
                        hasKeyChartSupport
                        hasSuggestionsSupport
                        taggable={{
                            type: TaggableType.Charts,
                            id: props.chartId,
                        }}
                    />
                    <small className="form-text text-muted">
                        Changes to tags will be applied instantly, without the
                        need to save the chart.
                    </small>
                </>
            ) : (
                <p>
                    Can't tag this chart
                    {!chartId && <>, because it hasn't been saved yet</>}.
                </p>
            )}
        </Section>
    )
}
