import * as React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import a from "indefinite"
import { Bounds, VerticalAlign } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    GRAPHER_FONT_SCALE_14,
} from "../core/GrapherConstants"
import { Halo, TextWrap, TextWrapSvg } from "@ourworldindata/components"
import { GRAPHER_DARK_TEXT, GRAPHER_LIGHT_TEXT } from "../color/ColorConstants"

export interface NoDataMessageManager {
    canChangeEntity?: boolean
    canAddEntities?: boolean
    entityType?: string
    entityTypePlural?: string
    fontSize?: number
    isStatic?: boolean
}

interface NoDataMessageProps {
    bounds?: Bounds
    message?: string
    helpText?: string
    hideTextOutline?: boolean
    manager: NoDataMessageManager
}

@observer
export class NoDataMessage extends React.Component<NoDataMessageProps> {
    constructor(props: NoDataMessageProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get manager(): NoDataMessageManager {
        return this.props.manager
    }

    @computed private get fontSize(): number {
        const baseFontSize = this.manager.fontSize ?? BASE_FONT_SIZE
        return Math.floor(GRAPHER_FONT_SCALE_14 * baseFontSize)
    }

    override render(): React.ReactElement {
        const { bounds, fontSize } = this
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
        const showHelpText = !isStatic && !!helpText
        const helpTextFontSize = Math.floor(0.9 * fontSize)

        const maxWidth = bounds.width - 2 * fontSize
        const messageWrap = new TextWrap({
            text: message || "No available data",
            maxWidth: bounds.width,
            fontSize,
            fontWeight: 500,
            verticalAlign: VerticalAlign.middle,
        })
        const helpWrap = showHelpText
            ? new TextWrap({
                  text: helpText,
                  maxWidth,
                  fontSize: helpTextFontSize,
                  verticalAlign: VerticalAlign.middle,
              })
            : undefined

        // Vertically center the message + help text block as a whole.
        const gap = helpWrap ? 0.5 * fontSize : 0
        const totalHeight = messageWrap.height + gap + (helpWrap?.height ?? 0)
        const top = center.y - totalHeight / 2
        const messageY = top + messageWrap.height / 2
        const helpY =
            top + messageWrap.height + gap + (helpWrap?.height ?? 0) / 2

        return (
            <g className="no-data">
                <rect {...bounds.toProps()} fill="#fff" opacity={0.6} />

                <Halo
                    id="no-data-message"
                    fontSize={fontSize}
                    show={!this.props.hideTextOutline}
                >
                    <TextWrapSvg
                        textWrap={messageWrap}
                        x={center.x}
                        y={messageY}
                        textAnchor="middle"
                        fill={GRAPHER_DARK_TEXT}
                    />
                </Halo>

                {helpWrap && (
                    <Halo
                        id="no-data-help"
                        fontSize={helpTextFontSize}
                        show={!this.props.hideTextOutline}
                    >
                        <TextWrapSvg
                            textWrap={helpWrap}
                            x={center.x}
                            y={helpY}
                            textAnchor="middle"
                            fill={GRAPHER_LIGHT_TEXT}
                        />
                    </Halo>
                )}
            </g>
        )
    }
}
