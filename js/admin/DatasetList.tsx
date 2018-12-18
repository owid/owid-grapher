import * as React from 'react'
import {observer} from 'mobx-react'
const timeago = require('timeago.js')()
import * as _ from 'lodash'

import Admin from './Admin'
import Link from './Link'
import TagBadge, { Tag } from './TagBadge'
import { AdminAppContext } from './AdminAppContext'

export interface DatasetListItem {
    id: number
    name: string
    namespace: string
    description: string
    dataEditedAt: Date
    dataEditedByUserName: string
    metadataEditedAt: Date
    metadataEditedByUserName: string
    tags: Tag[]
    isPrivate: boolean
}

@observer
class DatasetRow extends React.Component<{ dataset: DatasetListItem, searchHighlight?: (text: string) => any }> {
    static contextType = AdminAppContext

    render() {
        const {dataset, searchHighlight} = this.props

        const highlight = searchHighlight || _.identity

        return <tr>
            <td>{dataset.namespace}</td>
            <td>
            {dataset.isPrivate ? <span className="text-secondary">Unpublished: </span> : ""}<Link to={`/datasets/${dataset.id}`}>{highlight(dataset.name)}</Link>
            </td>
            <td>{highlight(dataset.description)}</td>
            <td>{dataset.tags.map(tag => <TagBadge tag={tag} key={tag.id} searchHighlight={searchHighlight}/>)}</td>
            <td>{timeago.format(dataset.dataEditedAt)} by {highlight(dataset.dataEditedByUserName)}</td>
        </tr>
    }
}

@observer
export default class DatasetList extends React.Component<{ datasets: DatasetListItem[], searchHighlight?: (text: string) => any }> {
    static contextType = AdminAppContext

    render() {
        const {props} = this
        return <table className="table table-bordered">
            <thead>
                <tr>
                    <th>Dataspace</th>
                    <th>Dataset</th>
                    <th>Notes</th>
                    <th>Tags</th>
                    <th>Uploaded</th>
                </tr>
            </thead>
            <tbody>
                {props.datasets.map(dataset => <DatasetRow dataset={dataset} key={dataset.id} searchHighlight={props.searchHighlight}/>)}
            </tbody>
        </table>
    }
}
