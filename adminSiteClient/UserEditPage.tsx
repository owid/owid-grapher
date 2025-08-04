import { Component } from "react"
import { observer } from "mobx-react"
import { observable, runInAction, makeObservable } from "mobx"
import { BindString, Toggle } from "./Forms.js"
import { Redirect } from "react-router-dom"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { UserIndexMeta } from "./UserMeta.js"

@observer
export class UserEditPage extends Component<{ userId: number }> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    user: UserIndexMeta | undefined = undefined
    isSaved: boolean = false

    constructor(props: { userId: number }) {
        super(props)

        makeObservable(this, {
            user: observable,
            isSaved: observable,
        })
    }

    override render() {
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
                        onValue={(v) => (user.isActive = v)}
                    />
                    <button
                        className="btn btn-success"
                        onClick={() => this.save()}
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

    override componentDidMount() {
        void this.getData()
    }
}
