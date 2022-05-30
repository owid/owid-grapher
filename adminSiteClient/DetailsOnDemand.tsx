import React from "react"
import { observable } from "mobx"
import { bind } from "decko"
import { observer } from "mobx-react"
import { AdminLayout } from "./AdminLayout.js"

interface Detail {
    category: string
    term: string
    title: string
    content: string
    id: number
}

@observer
export class DetailsOnDemandPage extends React.Component {
    @observable details: Detail[] = []

    @bind async getDetails() {
        const json = await this.context.admin.getJSON("/api/details")
        this.details = json.details
    }

    componentDidMount() {
        this.getDetails()
    }

    render() {
        return (
            <AdminLayout title="Details on Demand">
                <p>hello</p>
            </AdminLayout>
        )
    }
}
