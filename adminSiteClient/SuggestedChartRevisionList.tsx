import React from "react"
import { observer } from "mobx-react"
import * as lodash from "lodash-es"
import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons/faQuestionCircle.js"
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons/faCheckCircle.js"
import { faTimesCircle } from "@fortawesome/free-solid-svg-icons/faTimesCircle.js"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle.js"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { ChartListItem } from "./ChartList.js"
import { Link } from "./Link.js"
import { SuggestedChartRevisionStatus } from "../clientUtils/owidTypes.js"
import { Timeago } from "./Forms.js"

export interface SuggestedChartRevisionListItem {
    id: number
    chartId: number
    createdByFullName: string
    updatedByFullName: string
    status: SuggestedChartRevisionStatus
    decisionReason: string
    suggestedReason: string
    createdAt: Date
    updatedAt: Date
    originalConfig: ChartListItem
}

@observer
class SuggestedChartRevisionRow extends React.Component<{
    suggestedChartRevision: SuggestedChartRevisionListItem
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { suggestedChartRevision, searchHighlight } = this.props

        const highlight = searchHighlight || lodash.identity

        return (
            <tr>
                <td style={{ minWidth: "80px" }}>
                    <Link
                        to={`/suggested-chart-revisions/review/${suggestedChartRevision.id}`}
                    >
                        {suggestedChartRevision.id}
                    </Link>
                </td>
                <td style={{ minWidth: "80px" }}>
                    <Link
                        to={`/charts/${suggestedChartRevision.originalConfig.id}/edit`}
                    >
                        {suggestedChartRevision.originalConfig.id}
                    </Link>
                </td>
                <td style={{ minWidth: "120px" }}>
                    {suggestedChartRevision.originalConfig.isPublished ? (
                        <a
                            href={`${BAKED_GRAPHER_URL}/${suggestedChartRevision.originalConfig.slug}`}
                        >
                            {highlight(
                                suggestedChartRevision.originalConfig.title ??
                                    ""
                            )}
                        </a>
                    ) : (
                        <span>
                            <span style={{ color: "red" }}>Draft: </span>{" "}
                            {highlight(
                                suggestedChartRevision.originalConfig.title ??
                                    ""
                            )}
                        </span>
                    )}{" "}
                    {suggestedChartRevision.originalConfig.variantName ? (
                        <span style={{ color: "#aaa" }}>
                            (
                            {highlight(
                                suggestedChartRevision.originalConfig
                                    .variantName
                            )}
                            )
                        </span>
                    ) : undefined}
                    {suggestedChartRevision.originalConfig.internalNotes && (
                        <div className="internalNotes">
                            {highlight(
                                suggestedChartRevision.originalConfig
                                    .internalNotes
                            )}
                        </div>
                    )}
                </td>
                <td>
                    {suggestedChartRevision.suggestedReason
                        ? suggestedChartRevision.suggestedReason
                        : ""}
                </td>
                <td>
                    <Timeago
                        time={suggestedChartRevision.createdAt}
                        by={suggestedChartRevision.createdByFullName}
                    />
                </td>
                <td style={{ minWidth: "120px" }}>
                    <SuggestedChartRevisionStatusIcon
                        status={suggestedChartRevision.status}
                    />{" "}
                    {highlight(
                        (
                            suggestedChartRevision.status as unknown as string
                        ).toUpperCase()
                    )}
                    {suggestedChartRevision.updatedByFullName && (
                        <Timeago
                            time={suggestedChartRevision.updatedAt}
                            by={suggestedChartRevision.updatedByFullName}
                        />
                    )}
                </td>
                <td>
                    {suggestedChartRevision.decisionReason
                        ? suggestedChartRevision.decisionReason
                        : ""}
                </td>
            </tr>
        )
    }
}

@observer
export class SuggestedChartRevisionList extends React.Component<{
    suggestedChartRevisions: SuggestedChartRevisionListItem[]
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { suggestedChartRevisions, searchHighlight } = this.props
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Suggested revision Id</th>
                        <th>Chart Id</th>
                        <th>Title</th>
                        <th>Reason suggested</th>
                        <th>Revision suggested by</th>
                        <th>Status</th>
                        <th>Decision reason</th>
                    </tr>
                </thead>
                <tbody>
                    {suggestedChartRevisions.map((suggestedChartRevision) => (
                        <SuggestedChartRevisionRow
                            suggestedChartRevision={suggestedChartRevision}
                            key={suggestedChartRevision.id}
                            searchHighlight={searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}

@observer
export class SuggestedChartRevisionStatusIcon extends React.Component<{
    status: SuggestedChartRevisionStatus
    setColor?: boolean
}> {
    static defaultProps = {
        setColor: true,
    }
    render() {
        const { status, setColor } = this.props
        let color = "#9E9E9E"
        let icon = faQuestionCircle
        if (status === SuggestedChartRevisionStatus.approved) {
            color = "#0275d8"
            icon = faCheckCircle
        } else if (status === SuggestedChartRevisionStatus.rejected) {
            color = "#d9534f"
            icon = faTimesCircle
        } else if (status === SuggestedChartRevisionStatus.flagged) {
            color = "#f0ad4e"
            icon = faExclamationCircle
        }
        return <FontAwesomeIcon icon={icon} style={setColor ? { color } : {}} />
    }
}
