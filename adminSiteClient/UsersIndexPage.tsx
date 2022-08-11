import React from "react"
import { observer } from "mobx-react"
import { observable, action, runInAction } from "mobx"

import { Modal, Timeago } from "./Forms.js"
import { Link } from "./Link.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { UserIndexMeta } from "./UserMeta.js"

interface UserIndexMetaWithLastSeen extends UserIndexMeta {
    lastSeen: Date
}

@observer
class InviteModal extends React.Component<{ onClose: () => void }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable email: string = ""
    @observable fullName: string = ""
    @observable responseSuccess: boolean = false

    async submit() {
        runInAction(() => (this.responseSuccess = false))
        if (this.email) {
            const resp = await this.context.admin.requestJSON(
                "/api/users/add",
                { email: this.email, fullName: this.fullName },
                "POST"
            )
            console.log(resp)
            if (resp.success) {
                runInAction(() => (this.responseSuccess = true))
            }
        }
    }

    @action.bound onSubmit(event: React.FormEvent) {
        event.preventDefault()
        this.submit()
    }

    render() {
        return (
            <Modal onClose={this.props.onClose}>
                <form onSubmit={this.onSubmit}>
                    <div className="modal-header">
                        <h5 className="modal-title">Add a user</h5>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Full name</label>
                            <input
                                type="email"
                                className="form-control"
                                onChange={(e) =>
                                    (this.fullName = e.currentTarget.value)
                                }
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                className="form-control"
                                onChange={(e) =>
                                    (this.email = e.currentTarget.value)
                                }
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <input
                            type="submit"
                            className="btn btn-primary"
                            value="Add user"
                        />
                    </div>
                    {this.responseSuccess && (
                        <div className="alert alert-success" role="alert">
                            User added! They can now log in with their G Suite
                            account.
                        </div>
                    )}
                </form>
            </Modal>
        )
    }
}

@observer
export class UsersIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable users: UserIndexMetaWithLastSeen[] = []
    @observable isInviteModal: boolean = false

    @action.bound async onDelete(user: UserIndexMetaWithLastSeen) {
        if (
            !window.confirm(
                `Delete the user ${user.fullName}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/users/${user.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            runInAction(() => this.users.splice(this.users.indexOf(user), 1))
        }
    }

    render() {
        const { users } = this
        const { isSuperuser } = this.context.admin
        return (
            <AdminLayout title="Users">
                <main className="UsersIndexPage">
                    {this.isInviteModal && (
                        <InviteModal
                            onClose={action(() => (this.isInviteModal = false))}
                        />
                    )}
                    <div className="topbar">
                        <h2>Users</h2>
                        {isSuperuser && (
                            <button
                                onClick={action(
                                    () => (this.isInviteModal = true)
                                )}
                                className="btn btn-primary"
                            >
                                Add a user
                            </button>
                        )}
                    </div>
                    <table className="table table-bordered">
                        <tbody>
                            <tr>
                                <th>Name</th>
                                <th>Last Seen</th>
                                <th>Joined</th>
                                {isSuperuser && <th>Status</th>}
                                {isSuperuser && <th></th>}
                                {isSuperuser && <th></th>}
                            </tr>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>{user.fullName}</td>
                                    <td>
                                        <Timeago time={user.lastSeen} />
                                    </td>
                                    <td>
                                        <Timeago time={user.createdAt} />
                                    </td>
                                    {isSuperuser && (
                                        <td>
                                            {user.isActive
                                                ? "active"
                                                : "disabled"}
                                        </td>
                                    )}
                                    {isSuperuser && (
                                        <td>
                                            <Link
                                                to={`/users/${user.id}`}
                                                className="btn btn-primary"
                                            >
                                                Edit
                                            </Link>
                                        </td>
                                    )}
                                    {isSuperuser && (
                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() =>
                                                    this.onDelete(user)
                                                }
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { admin } = this.context

        const json = (await admin.getJSON("/api/users.json")) as {
            users: UserIndexMetaWithLastSeen[]
        }

        runInAction(() => {
            this.users = json.users
        })
    }

    componentDidMount() {
        this.getData()
    }
}
