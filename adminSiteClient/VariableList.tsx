import * as React from "react"
import { observer } from "mobx-react"
import { Popover } from "antd"

import { Link } from "./Link.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"

export interface VariableListItem {
    id: number
    name: string
    namespace?: string
    version?: string
    dataset?: string
    table?: string
    shortName?: string
    uploadedAt?: Date
    uploadedBy?: string
    isPrivate?: boolean
    nonRedistributable?: boolean
    chartsCount?: number
    multiDimCount?: number
    explorersCount?: number
    usageCount?: number
    multiDims?: { id: number; slug: string }[]
    explorerSlugs?: string[]
}

interface VariableRowProps {
    variable: VariableListItem
    fields: string[]
    searchHighlight?: (text: string) => string | React.ReactElement
}

@observer
class VariableRow extends React.Component<VariableRowProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    override render() {
        const { variable, fields, searchHighlight } = this.props

        return (
            <tr>
                <td>
                    {variable.nonRedistributable ? (
                        <span className="text-secondary">
                            Non-redistributable:{" "}
                        </span>
                    ) : variable.isPrivate ? (
                        <span className="text-secondary">Unpublished: </span>
                    ) : (
                        ""
                    )}
                    <Link to={`/variables/${variable.id}`}>
                        {searchHighlight
                            ? searchHighlight(variable.name)
                            : variable.name}
                    </Link>
                </td>
                {fields.includes("namespace") && <td>{variable.namespace}</td>}
                {fields.includes("version") && <td>{variable.version}</td>}
                {fields.includes("dataset") && <td>{variable.dataset}</td>}
                {fields.includes("table") && (
                    <td>
                        {
                            // Some table are very long, truncate them
                            variable.table && variable.table.length > 20
                                ? variable.table.substring(0, 20) + "..."
                                : variable.table
                        }
                    </td>
                )}
                {fields.includes("shortName") && (
                    <td>
                        {
                            // Some "short names" are very long, so truncate them
                            variable.shortName && variable.shortName.length > 20
                                ? variable.shortName.substring(0, 20) + "..."
                                : variable.shortName
                        }
                    </td>
                )}
                {fields.includes("uploadedAt") && (
                    <td>
                        <Timeago
                            time={variable.uploadedAt}
                            by={variable.uploadedBy ?? "Bulk import"}
                        />
                    </td>
                )}
                {fields.includes("usage") && (
                    <td>
                        {(variable.usageCount ?? 0) > 0 ? (
                            <>
                                {variable.usageCount} (
                                <span title="Used in N charts">
                                    {variable.chartsCount}C
                                </span>{" "}
                                {(variable.multiDims?.length ?? 0) > 0 ? (
                                    <Popover
                                        title="Multi-dim pages"
                                        content={
                                            <ul className="list-unstyled mb-0">
                                                {variable.multiDims!.map(
                                                    (md) => (
                                                        <li key={md.id}>
                                                            <a
                                                                href={`/admin/multi-dims/${md.id}`}
                                                            >
                                                                {md.slug}
                                                            </a>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        }
                                    >
                                        <span
                                            style={{ cursor: "help" }}
                                            className="text-decoration-underline"
                                        >
                                            {variable.multiDimCount}M
                                        </span>
                                    </Popover>
                                ) : (
                                    <span title="Used in N multi-dim pages">
                                        {variable.multiDimCount}M
                                    </span>
                                )}{" "}
                                {(variable.explorerSlugs?.length ?? 0) > 0 ? (
                                    <Popover
                                        title="Path-based explorers"
                                        content={
                                            <ul className="list-unstyled mb-0">
                                                {variable.explorerSlugs!.map(
                                                    (slug) => (
                                                        <li key={slug}>
                                                            <a
                                                                href={`/admin/explorers/${slug}`}
                                                            >
                                                                {slug}
                                                            </a>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        }
                                    >
                                        <span
                                            style={{ cursor: "help" }}
                                            className="text-decoration-underline"
                                        >
                                            {variable.explorersCount}E
                                        </span>
                                    </Popover>
                                ) : (
                                    <span title="Used in N path-based explorers">
                                        {variable.explorersCount}E
                                    </span>
                                )}
                                )
                            </>
                        ) : (
                            <span className="text-muted">—</span>
                        )}
                    </td>
                )}
            </tr>
        )
    }
}

export type VariableListSortField = "usageCount"
export interface VariableListSortConfig {
    field: VariableListSortField
    direction: "asc" | "desc"
}

interface VariableListProps {
    variables: VariableListItem[]
    fields: string[]
    searchHighlight?: (text: string) => string | React.ReactElement
    sortConfig?: VariableListSortConfig | null
    onSort?: (config: VariableListSortConfig | null) => void
}

@observer
export class VariableList extends React.Component<VariableListProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    renderSortableHeader(field: VariableListSortField, label: string) {
        const { sortConfig, onSort } = this.props
        if (!onSort) return <th>{label}</th>
        const indicator =
            sortConfig?.field === field
                ? sortConfig.direction === "desc"
                    ? " ↓"
                    : " ↑"
                : ""
        const handleClick = () => {
            if (!sortConfig || sortConfig.field !== field) {
                onSort({ field, direction: "desc" })
            } else if (sortConfig.direction === "desc") {
                onSort({ field, direction: "asc" })
            } else {
                onSort(null)
            }
        }
        return (
            <th style={{ cursor: "pointer" }} onClick={handleClick}>
                {label}
                {indicator}
            </th>
        )
    }

    override render() {
        const { props } = this
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Name</th>
                        {props.fields.includes("namespace") && (
                            <th>Namespace</th>
                        )}
                        {props.fields.includes("version") && <th>Version</th>}
                        {props.fields.includes("dataset") && <th>Dataset</th>}
                        {props.fields.includes("table") && <th>Table</th>}
                        {props.fields.includes("shortName") && (
                            <th>Short name</th>
                        )}
                        {props.fields.includes("uploadedAt") && (
                            <th>Uploaded</th>
                        )}
                        {props.fields.includes("usage") &&
                            this.renderSortableHeader("usageCount", "Usage")}
                    </tr>
                </thead>
                <tbody>
                    {props.variables.map((variable) => (
                        <VariableRow
                            key={variable.id}
                            fields={this.props.fields}
                            variable={variable}
                            searchHighlight={props.searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}
