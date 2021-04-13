import * as React from "react"
import { observer } from "mobx-react"
import { format } from "timeago.js"
import * as lodash from "lodash"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons/faQuestionCircle"
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons/faCheckCircle"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons/faTimesCircle"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings"
import { ChartListItem } from "./ChartList"

export interface SuggestedRevisionListItem {
    id: number
    chartId: number
    userId: number
    user: string
    status: string
    decisionReason: string
    createdReason: string
    createdAt: Date
    updatedAt: Date
    existingConfig: ChartListItem
    suggestedConfig: ChartListItem
}

@observer
class SuggestedRevisionRow extends React.Component<{
    suggestedRevision: SuggestedRevisionListItem
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    // @computed get suggestedConfigSvg() {
    //     const svg = new Grapher(this.props.suggestedRevision.suggestedConfig).staticSVG
    //     return svg
    // }

    render() {
        const { suggestedRevision, searchHighlight } = this.props

        const highlight = searchHighlight || lodash.identity
        // const suggestedConfig = new Grapher(suggestedRevision.suggestedConfig)

        return (
            <tr>
                <td style={{ minWidth: "140px", width: "12.5%" }}>
                    {suggestedRevision.existingConfig.isPublished && (
                        <a
                            href={`${BAKED_GRAPHER_URL}/${suggestedRevision.existingConfig.slug}`}
                        >
                            <img
                                src={`${BAKED_GRAPHER_URL}/exports/${suggestedRevision.existingConfig.slug}.svg`}
                                className="chartPreview"
                            />
                        </a>
                    )}
                </td>
                {/* <td style={{ minWidth: "140px", width: "12.5%" }}>
                    {suggestedRevision.existingConfig.isPublished && this.suggestedConfigSvg && (
                        <a href={""}>
                            <img
                                src={`data:image/svg+xml;utf8,${encodeURIComponent(this.suggestedConfigSvg)}`}
                                className="chartPreview"
                            />
                        </a>
                    )}
                </td> */}
                <td style={{ minWidth: "100px" }}>
                    {suggestedRevision.existingConfig.id}
                </td>
                <td style={{ minWidth: "120px" }}>
                    {suggestedRevision.existingConfig.isPublished ? (
                        <a
                            href={`${BAKED_GRAPHER_URL}/${suggestedRevision.existingConfig.slug}`}
                        >
                            {highlight(
                                suggestedRevision.existingConfig.title ?? ""
                            )}
                        </a>
                    ) : (
                        <span>
                            <span style={{ color: "red" }}>Draft: </span>{" "}
                            {highlight(
                                suggestedRevision.existingConfig.title ?? ""
                            )}
                        </span>
                    )}{" "}
                    {suggestedRevision.existingConfig.variantName ? (
                        <span style={{ color: "#aaa" }}>
                            (
                            {highlight(
                                suggestedRevision.existingConfig.variantName
                            )}
                            )
                        </span>
                    ) : undefined}
                    {suggestedRevision.existingConfig.internalNotes && (
                        <div className="internalNotes">
                            {highlight(
                                suggestedRevision.existingConfig.internalNotes
                            )}
                        </div>
                    )}
                </td>
                <td>
                    {suggestedRevision.createdReason
                        ? suggestedRevision.createdReason
                        : ""}
                </td>
                <td>
                    {format(suggestedRevision.createdAt)} by{" "}
                    {suggestedRevision.user}
                </td>
                <td style={{ minWidth: "120px" }}>
                    {suggestedRevision.status === "pending" && (
                        <FontAwesomeIcon
                            icon={faQuestionCircle}
                            style={{ color: "#9E9E9E" }}
                        />
                    )}
                    {suggestedRevision.status === "approved" && (
                        <FontAwesomeIcon
                            icon={faCheckCircle}
                            style={{ color: "#2196F3" }}
                        />
                    )}
                    {suggestedRevision.status === "rejected" && (
                        <FontAwesomeIcon
                            icon={faTimesCircle}
                            style={{ color: "#f44336" }}
                        />
                    )}{" "}
                    {suggestedRevision.status === "pending" &&
                        suggestedRevision.status.toUpperCase()}
                    {(suggestedRevision.status === "approved" ||
                        suggestedRevision.status === "rejected") &&
                        `
                        ${highlight(suggestedRevision.status.toUpperCase())} - 
                        ${format(suggestedRevision.updatedAt)} 
                        by ${suggestedRevision.user}
                    `}
                </td>
                <td>
                    {suggestedRevision.decisionReason
                        ? suggestedRevision.decisionReason
                        : ""}
                </td>
            </tr>
        )
    }
}

@observer
export class SuggestedRevisionList extends React.Component<{
    suggestedRevisions: SuggestedRevisionListItem[]
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { suggestedRevisions, searchHighlight } = this.props
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Published chart</th>
                        <th>Chart Id</th>
                        <th>Title</th>
                        <th>Created reason</th>
                        <th>Revision suggested by</th>
                        <th>Status</th>
                        <th>Decision reason</th>
                    </tr>
                </thead>
                <tbody>
                    {suggestedRevisions.map((suggestedRevision) => (
                        <SuggestedRevisionRow
                            suggestedRevision={suggestedRevision}
                            key={suggestedRevision.id}
                            searchHighlight={searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}
