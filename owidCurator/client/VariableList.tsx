import * as React from "react"
import { observer } from "mobx-react"
const timeago = require("timeago.js")()

import { Link } from "./Link"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"

export interface VariableListItem {
    id: number
    name: string
    uploadedAt?: Date
    uploadedBy?: string
    isPrivate?: boolean
}

@observer
class VariableRow extends React.Component<{
    variable: VariableListItem
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { variable, searchHighlight } = this.props

        return (
            <tr>
                <td>
                    {variable.isPrivate ? (
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
                {variable.uploadedAt && (
                    <td>
                        {timeago.format(variable.uploadedAt)} by{" "}
                        {variable.uploadedBy
                            ? variable.uploadedBy
                            : "Bulk import"}
                    </td>
                )}
            </tr>
        )
    }
}

@observer
export class VariableList extends React.Component<{
    variables: VariableListItem[]
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { props } = this
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Variable</th>
                        {props.variables.some(
                            v => v.uploadedAt !== undefined
                        ) && <th>Uploaded</th>}
                    </tr>
                </thead>
                <tbody>
                    {props.variables.map(variable => (
                        <VariableRow
                            key={variable.id}
                            variable={variable}
                            searchHighlight={props.searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}
