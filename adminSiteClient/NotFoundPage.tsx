import { Component } from "react"
import { observer } from "mobx-react"
import { AdminLayout } from "./AdminLayout.js"

@observer
export class NotFoundPage extends Component {
    render() {
        return (
            <AdminLayout>
                <main className="NotFoundPage">
                    <h1>404 Not Found</h1>
                </main>
            </AdminLayout>
        )
    }
}
