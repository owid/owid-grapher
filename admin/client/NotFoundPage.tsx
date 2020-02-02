import { observer } from "mobx-react"
import * as React from "react"
import { AdminLayout } from "./AdminLayout"

@observer
export class NotFoundPage extends React.Component {
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
