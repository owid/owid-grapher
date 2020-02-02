import { action, observable } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
const timeago = require("timeago.js")()
import { bind } from "decko"
import * as _ from "lodash"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { EditableTags } from "./Forms"
import { Link } from "./Link"
import { Tag } from "./TagBadge"

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
class DatasetRow extends React.Component<{
    dataset: DatasetListItem
    availableTags: Tag[]
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    async saveTags(tags: Tag[]) {
        const { dataset } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/setTags`,
            { tagIds: tags.map(t => t.id) },
            "POST"
        )
        if (json.success) {
            dataset.tags = tags
        }
    }

    @action.bound onSaveTags(tags: Tag[]) {
        this.saveTags(tags)
    }

    render() {
        const { dataset, searchHighlight, availableTags } = this.props

        const highlight = searchHighlight || _.identity

        return (
            <tr>
                <td>{dataset.namespace}</td>
                <td>
                    {dataset.isPrivate ? (
                        <span className="text-secondary">Unpublished: </span>
                    ) : (
                        ""
                    )}
                    <Link to={`/datasets/${dataset.id}`}>
                        {highlight(dataset.name)}
                    </Link>
                </td>
                <td>{highlight(dataset.description)}</td>
                <td>
                    <EditableTags
                        tags={dataset.tags}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                        disabled={dataset.namespace !== "owid"}
                    />
                </td>
                <td>
                    {timeago.format(dataset.dataEditedAt)} by{" "}
                    {highlight(dataset.dataEditedByUserName)}
                </td>
            </tr>
        )
    }
}

@observer
export class DatasetList extends React.Component<{
    datasets: DatasetListItem[]
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable availableTags: Tag[] = []

    @bind async getTags() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        this.availableTags = json.tags
    }

    componentDidMount() {
        this.getTags()
    }

    render() {
        const { props } = this
        return (
            <table className="table table-bordered">
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
                    {props.datasets.map(dataset => (
                        <DatasetRow
                            dataset={dataset}
                            availableTags={this.availableTags}
                            key={dataset.id}
                            searchHighlight={props.searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}
