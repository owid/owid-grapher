import React from "react"
import { action, observable } from "mobx"
import { bind } from "decko"
import { observer } from "mobx-react"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { every, sortBy } from "lodash"
import { Controlled } from "react-codemirror2"

interface Detail {
    category: string
    term: string
    title: string
    content: string
    id: number
}

type DraftDetail = Omit<Detail, "id">

const detailKeys = ["category", "term", "title", "content"] as const

interface DetailRowProps {
    detail: Detail
    deleteDetail: (id: number) => Promise<void>
}

@observer
class DetailRow extends React.Component<DetailRowProps> {
    @observable isEditing: boolean = false
    @observable isDeleting: boolean = false
    deleteButtonRef = React.createRef<HTMLButtonElement>()

    static contextType = AdminAppContext
    context!: AdminAppContextType

    constructor(props: DetailRowProps) {
        super(props)
        this.handleClickOff = this.handleClickOff.bind(this)
    }

    @action.bound async handleEdit() {
        if (this.isEditing) {
            await this.context.admin.requestJSON(
                `/api/details/${this.props.detail.id}`,
                this.props.detail,
                "PUT"
            )
            this.isEditing = false
        } else {
            this.isEditing = true
        }
    }

    @action.bound handleClickOff(event: Event) {
        const target = (event as unknown as React.MouseEvent<HTMLBodyElement>)
            .target

        if (!this.deleteButtonRef?.current?.contains(target as Node)) {
            const body = document.querySelector("body")
            body?.removeEventListener("click", this.handleClickOff)
            this.isDeleting = false
        }
    }

    @action.bound async handleDelete() {
        if (this.isDeleting) {
            await this.props.deleteDetail(this.props.detail.id)
            const body = document.querySelector("body")
            body?.removeEventListener("click", this.handleClickOff)
        } else {
            const body = document.querySelector("body")
            body?.addEventListener("click", this.handleClickOff)
            this.isDeleting = true
        }
    }
    render() {
        return (
            <tr>
                {detailKeys.map((key) => {
                    if (this.isEditing) {
                        return (
                            <td key={key}>
                                <Controlled
                                    options={{
                                        lineWrapping: true,
                                        extraKeys: {
                                            Tab: false,
                                            "Shift-Tab": false,
                                        },
                                    }}
                                    className="details__codemirror"
                                    onBeforeChange={(_, __, value) => {
                                        this.props.detail[key] = value
                                    }}
                                    value={this.props.detail[key]}
                                />
                            </td>
                        )
                    }
                    return (
                        <td key={key}>
                            <span>{this.props.detail[key]}</span>
                        </td>
                    )
                })}
                <td>
                    <div className="d-flex justify-content-between">
                        <button
                            disabled={this.isDeleting}
                            className="btn btn-primary"
                            onClick={() => this.handleEdit()}
                        >
                            {this.isEditing ? "Save" : "Edit"}
                        </button>
                        <button
                            ref={this.deleteButtonRef}
                            className="btn btn-danger"
                            onClick={() => this.handleDelete()}
                        >
                            {this.isDeleting ? "Are you sure?" : "Delete"}
                        </button>
                    </div>
                </td>
            </tr>
        )
    }
}

@observer
class NewDetail extends React.Component<{
    details: Detail[]
}> {
    @observable.deep detail: DraftDetail = {
        category: "",
        term: "",
        title: "",
        content: "",
    }
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @action.bound async handleSubmit() {
        const { id } = await this.context.admin.requestJSON(
            "/api/details",
            this.detail,
            "POST"
        )

        this.props.details.push({
            ...this.detail,
            id,
        })

        this.detail = {
            category: "",
            term: "",
            title: "",
            content: "",
        }
    }

    render() {
        return (
            <tr>
                {detailKeys.map((key) => (
                    <td key={key}>
                        <Controlled
                            options={{
                                lineWrapping: true,
                                extraKeys: { Tab: false, "Shift-Tab": false },
                            }}
                            className="details__codemirror"
                            onBeforeChange={(_, __, value) => {
                                this.detail[key] = value
                            }}
                            value={this.detail[key]}
                        />
                    </td>
                ))}
                <td>
                    <button
                        className="btn btn-primary"
                        onClick={() => this.handleSubmit()}
                        disabled={!every(this.detail)}
                    >
                        Submit
                    </button>
                </td>
            </tr>
        )
    }
}

@observer
export class DetailsOnDemandPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable.deep details: Array<Detail> = []
    sortKey: keyof Detail = "id"

    @bind async getDetails() {
        const json = await this.context.admin.getJSON("/api/details")
        this.details = json.details
    }

    @bind async deleteDetail(id: number) {
        await this.context.admin.requestJSON(`/api/details/${id}`, {}, "DELETE")
        this.details = this.details.filter((detail) => detail.id !== id)
    }

    componentDidMount() {
        this.getDetails()
    }

    sortBy(key: keyof Detail) {
        if (key === this.sortKey) this.details = this.details.slice().reverse()
        else {
            this.sortKey = key
            this.details = sortBy(this.details, (detail) => detail[key])
        }
    }

    render() {
        return (
            <AdminLayout title="Details on Demand">
                <table className="table table-bordered dod-table">
                    <thead>
                        <tr>
                            {detailKeys.map((key) => (
                                <th
                                    key={key}
                                    className={`dod-table-header--${key}`}
                                    onClick={() => this.sortBy(key)}
                                >
                                    {key}
                                </th>
                            ))}
                            <th className="dod-table-header--actions">
                                actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.details.map((detail) => (
                            <DetailRow
                                detail={detail}
                                deleteDetail={this.deleteDetail}
                                key={detail.id}
                            />
                        ))}
                        <NewDetail details={this.details} />
                    </tbody>
                </table>
            </AdminLayout>
        )
    }
}
