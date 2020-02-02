import { observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { Redirect } from "react-router-dom"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { AdminLayout } from "./AdminLayout"
import { BindString, Toggle } from "./Forms"

interface UserIndexMeta {
    id: number
    name: string
    fullName: string
    createdAt: Date
    updatedAt: Date
    isActive: boolean
}

@observer
export class UserEditPage extends React.Component<{ userId: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable user?: UserIndexMeta
    @observable isSaved: boolean = false

    render() {
        const { user, isSaved } = this
        if (!user) return null
        else if (isSaved) return <Redirect to="/users" />

        return (
            <AdminLayout>
                <main className="UserEditPage">
                    <BindString
                        label="Full Name"
                        field="fullName"
                        store={user}
                    />
                    <Toggle
                        label="User has access"
                        value={user.isActive}
                        onValue={v => (user.isActive = v)}
                    />
                    <button
                        className="btn btn-success"
                        onClick={_ => this.save()}
                    >
                        Update user
                    </button>
                </main>
            </AdminLayout>
        )
    }

    async save() {
        if (this.user) {
            await this.context.admin.requestJSON(
                `/api/users/${this.props.userId}`,
                this.user,
                "PUT"
            )
            this.isSaved = true
        }
    }

    async getData() {
        const { admin } = this.context

        const json = await admin.getJSON(`/api/users/${this.props.userId}.json`)
        runInAction(() => {
            this.user = json.user
        })
    }

    componentDidMount() {
        this.getData()
    }
}
