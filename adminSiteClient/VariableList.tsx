import React from "react"
import { observer } from "mobx-react"

import { Link } from "./Link.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Timeago } from "./Forms.js"

export interface VariableListItem {
    id: number
    name: string
    uploadedAt?: Date
    uploadedBy?: string
    isPrivate?: boolean
    nonRedistributable?: boolean
}

const VariableRow = observer(
    class VariableRow extends React.Component<{
        variable: VariableListItem
        searchHighlight?: (text: string) => string | JSX.Element
    }> {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        render() {
            const { variable, searchHighlight } = this.props

            return (
                <tr>
                    <td>
                        {variable.nonRedistributable ? (
                            <span className="text-secondary">
                                Non-redistributable:{" "}
                            </span>
                        ) : variable.isPrivate ? (
                            <span className="text-secondary">
                                Unpublished:{" "}
                            </span>
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
)

export const VariableList = observer(
    class VariableList extends React.Component<{
        variables: VariableListItem[]
        searchHighlight?: (text: string) => string | JSX.Element
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
                                (v) => v.uploadedAt !== undefined
                            ) && <th>Uploaded</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {props.variables.map((variable) => (
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
)
