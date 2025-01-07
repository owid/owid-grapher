import * as React from "react"
import { observer } from "mobx-react"

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
}

@observer
class VariableRow extends React.Component<{
    variable: VariableListItem
    fields: string[]
    searchHighlight?: (text: string) => string | React.ReactElement
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
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
                            variable.table && variable.table!.length > 20
                                ? variable.table!.substring(0, 20) + "..."
                                : variable.table
                        }
                    </td>
                )}
                {fields.includes("shortName") && (
                    <td>
                        {
                            // Some "short names" are very long, so truncate them
                            variable.shortName &&
                            variable.shortName!.length > 20
                                ? variable.shortName!.substring(0, 20) + "..."
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
            </tr>
        )
    }
}

@observer
export class VariableList extends React.Component<{
    variables: VariableListItem[]
    fields: string[]
    searchHighlight?: (text: string) => string | React.ReactElement
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
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
