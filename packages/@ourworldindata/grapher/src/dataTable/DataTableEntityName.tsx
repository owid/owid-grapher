import * as React from "react"
import { Tippy } from "@ourworldindata/utils"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { SeriesLabelAnnotations } from "../seriesLabel/SeriesLabelAnnotations"

export function DataTableEntityName({
    entityName,
    annotationText,
}: {
    entityName: string
    annotationText?: string
}): React.ReactElement {
    if (!annotationText) return <div className="entity-name">{entityName}</div>

    return (
        <Tippy
            theme="grapher-explanation"
            placement="bottom-start"
            arrow={false}
            offset={[0, 4]}
            interactive
            delay={[100, 200]}
            appendTo={() => document.body}
            content={
                <SeriesLabelAnnotations
                    annotations={[{ text: annotationText, timeScope: "all" }]}
                    color={GRAPHER_DARK_TEXT}
                />
            }
        >
            <div className="entity-name entity-name--annotated">
                {entityName}
            </div>
        </Tippy>
    )
}
