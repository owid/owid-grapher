import React from "react"
import { observable, action, makeObservable } from "mobx";
import { observer } from "mobx-react"
import * as lodash from "lodash"
import { bind } from "decko"

import { Link } from "./Link.js"
import { Tag } from "./TagBadge.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { EditableTags, Timeago } from "./Forms.js"

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
    nonRedistributable: boolean
}

const DatasetRow = observer(class DatasetRow extends React.Component<{
    dataset: DatasetListItem
    availableTags: Tag[]
    searchHighlight?: (text: string) => string | JSX.Element
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    constructor(
        props: {
            dataset: DatasetListItem
            availableTags: Tag[]
            searchHighlight?: (text: string) => string | JSX.Element
        }
    ) {
        super(props);

        makeObservable(this, {
            onSaveTags: action.bound
        });
    }

    async saveTags(tags: Tag[]) {
        const { dataset } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/setTags`,
            { tagIds: tags.map((t) => t.id) },
            "POST"
        )
        if (json.success) {
            dataset.tags = tags
        }
    }

    onSaveTags(tags: Tag[]) {
        this.saveTags(tags)
    }

    render() {
        const { dataset, searchHighlight, availableTags } = this.props

        const highlight = searchHighlight || lodash.identity

        return (
            <tr>
                <td>{dataset.namespace}</td>
                <td>
                    {dataset.nonRedistributable ? (
                        <span className="text-secondary">
                            Non-redistributable:{" "}
                        </span>
                    ) : dataset.isPrivate ? (
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
                    <Timeago
                        time={dataset.dataEditedAt}
                        by={highlight(dataset.dataEditedByUserName)}
                    />
                </td>
            </tr>
        )
    }
});

export const DatasetList = observer(class DatasetList extends React.Component<{
    datasets: DatasetListItem[]
    searchHighlight?: (text: string) => string | JSX.Element
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    availableTags: Tag[] = [];

    constructor(
        props: {
            datasets: DatasetListItem[]
            searchHighlight?: (text: string) => string | JSX.Element
        }
    ) {
        super(props);

        makeObservable(this, {
            availableTags: observable
        });
    }

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
                    {props.datasets.map((dataset) => (
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
});
