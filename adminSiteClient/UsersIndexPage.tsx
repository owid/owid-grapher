import * as React from "react"
import { observer } from "mobx-react"
import { observable, action, runInAction, makeObservable } from "mobx"

import { FieldsRow, Modal, TextField, Timeago } from "./Forms.js"
import { Link } from "./Link.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { UserIndexMeta } from "./UserMeta.js"
import { useListSearch } from "./useListSearch.js"

interface UserIndexMetaWithLastSeen extends UserIndexMeta {
    lastSeen: Date
}

@observer
class InviteModal extends React.Component<{ onClose: () => void }> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    email: string = ""
    fullName: string = ""
    responseSuccess: boolean = false

    constructor(props: { onClose: () => void }) {
        super(props)

        makeObservable(this, {
            email: observable,
            fullName: observable,
            responseSuccess: observable,
        })
    }

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

    @action.bound onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        void this.submit()
    }

    override render() {
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
                                type="text"
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

const searchedText = (user: UserIndexMetaWithLastSeen) => [
    user.fullName,
    user.name,
]

export function UsersIndexPage() {
    const { admin } = React.useContext(AdminAppContext)
    const { isSuperuser } = admin
    const [users, setUsers] = React.useState<UserIndexMetaWithLastSeen[]>([])
    const [isInviteModal, setIsInviteModal] = React.useState(false)
    const { searchValue, setSearchValue, filtered, highlight } = useListSearch(
        users,
        searchedText
    )

    React.useEffect(() => {
        void admin
            .getJSON<{
                users: UserIndexMetaWithLastSeen[]
            }>("/api/users.json")
            .then((json) => setUsers(json.users))
    }, [admin])

    const onDelete = async (user: UserIndexMetaWithLastSeen) => {
        if (
            !window.confirm(
                `Delete the user ${user.fullName}? This action cannot be undone!`
            )
        )
            return

        const json = await admin.requestJSON(
            `/api/users/${user.id}`,
            {},
            "DELETE"
        )

        if (json.success)
            setUsers((users) => users.filter(({ id }) => id !== user.id))
    }

    return (
        <AdminLayout title="Users">
            <main className="UsersIndexPage">
                {isInviteModal && (
                    <InviteModal onClose={() => setIsInviteModal(false)} />
                )}
                <div className="topbar">
                    <h2>Users</h2>
                    {isSuperuser && (
                        <button
                            onClick={() => setIsInviteModal(true)}
                            className="btn btn-primary"
                        >
                            Add a user
                        </button>
                    )}
                </div>
                <FieldsRow>
                    <TextField
                        placeholder="Search users..."
                        value={searchValue}
                        onValue={setSearchValue}
                        autofocus
                    />
                </FieldsRow>
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
                        {filtered.map((user) => (
                            <tr key={user.id}>
                                <td>{highlight(user.fullName)}</td>
                                <td>
                                    <Timeago time={user.lastSeen} />
                                </td>
                                <td>
                                    <Timeago time={user.createdAt} />
                                </td>
                                {isSuperuser && (
                                    <td>
                                        {user.isActive ? "active" : "disabled"}
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
                                            onClick={() => onDelete(user)}
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
