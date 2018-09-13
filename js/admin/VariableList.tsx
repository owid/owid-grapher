import * as React from 'react'
import {observer} from 'mobx-react'
const timeago = require('timeago.js')()

import Admin from './Admin'
import Link from './Link'

export interface VariableListItem {
    id: number
    name: string
    uploadedAt?: Date
    uploadedBy?: string
}

@observer
class VariableRow extends React.Component<{ variable: VariableListItem, searchHighlight?: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {variable, searchHighlight} = this.props
        const {admin} = this.context

        return <tr>
            <td>
                <Link to={`/variables/${variable.id}`}>{searchHighlight ? searchHighlight(variable.name) : variable.name}</Link>
            </td>
            {variable.uploadedAt && <td>{timeago.format(variable.uploadedAt)} by {variable.uploadedBy ? variable.uploadedBy : "Bulk import"}</td>}
        </tr>
    }
}

@observer
export default class VariableList extends React.Component<{ variables: VariableListItem[], searchHighlight?: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {props} = this
        return <table className="table table-bordered">
            <thead>
                <tr>
                    <th>Variable</th>
                    {props.variables.some(v => v.uploadedAt !== undefined) && <th>Uploaded</th>}
                </tr>
            </thead>
                <tbody>
                {props.variables.map(variable => <VariableRow variable={variable} searchHighlight={props.searchHighlight}/>)}
            </tbody>
        </table>
    }
}
