import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ObservedReactComponent, Halo  } from "@ourworldindata/components"
import a from "indefinite"
import {
    Bounds,
    DEFAULT_BOUNDS,
    VerticalAlign,
    dyFromAlign,
} from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    GRAPHER_TEXT_OUTLINE_FACTOR,
} from "../core/GrapherConstants"
import { GRAPHER_DARK_TEXT, GRAPHER_LIGHT_TEXT } from "../color/ColorConstants"

export interface NoDataModalManager {
    canChangeEntity?: boolean
    canAddEntities?: boolean
    entityType?: string
    entityTypePlural?: string
    fontSize?: number
    isStatic?: boolean
}

@observer
export class NoDataModal extends ObservedReactComponent<{
    bounds?: Bounds
    message?: string
    helpText?: string
    hideTextOutline?: boolean
    manager: NoDataModalManager
}> {
    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get manager(): NoDataModalManager {
        return this.props.manager
    }

    @computed private get fontSize(): number {
        // font sizes bigger than the base font size are too large for the no data text
        return Math.min(this.manager.fontSize ?? BASE_FONT_SIZE, BASE_FONT_SIZE)
    }

    render(): React.ReactElement {
        const { bounds } = this
        const { message } = this.props
        const {
            entityType = DEFAULT_GRAPHER_ENTITY_TYPE,
            entityTypePlural = DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
            canAddEntities,
            canChangeEntity,
            isStatic,
        } = this.manager

        const defaultHelpText = canAddEntities
            ? `Try adding ${entityTypePlural} to display data.`
            : canChangeEntity
              ? `Try choosing ${a(entityType)} to display data.`
              : undefined
        const helpText = this.props.helpText ?? defaultHelpText

        const center = bounds.centerPos
        const padding = 0.75 * this.fontSize
        const showHelpText = !isStatic && !!helpText
        const helpTextFontSize = 0.9 * this.fontSize

        return (
            <g className="no-data">
                <rect {...bounds.toProps()} fill="#fff" opacity={0.6} />

                <Halo
                    id="no-data-message"
                    outlineWidth={GRAPHER_TEXT_OUTLINE_FACTOR * this.fontSize}
                    show={!this.props.hideTextOutline}
                >
                    <text
                        x={center.x}
                        y={center.y}
                        dy={
                            showHelpText
                                ? -padding / 2
                                : dyFromAlign(VerticalAlign.middle)
                        }
                        textAnchor="middle"
                        fontSize={this.fontSize}
                        fontWeight={500}
                        fill={GRAPHER_DARK_TEXT}
                    >
                        {message || "No available data"}
                    </text>
                </Halo>

                {showHelpText && (
                    <Halo
                        id="no-data-help"
                        outlineWidth={
                            GRAPHER_TEXT_OUTLINE_FACTOR * helpTextFontSize
                        }
                        show={!this.props.hideTextOutline}
                    >
                        <text
                            x={center.x}
                            y={center.y + padding / 2}
                            textAnchor="middle"
                            dy={dyFromAlign(VerticalAlign.bottom)}
                            fontSize={helpTextFontSize}
                            fill={GRAPHER_LIGHT_TEXT}
                        >
                            {helpText}
                        </text>
                    </Halo>
                )}
            </g>
        )
    }
}
