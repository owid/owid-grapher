import React from "react"
import { observer } from "mobx-react"
import { AdminLayout } from "./AdminLayout.js"

export const NotFoundPage = observer(class NotFoundPage extends React.Component {
    render() {
        return (
            <AdminLayout>
                <main className="NotFoundPage">
                    <h1>404 Not Found</h1>
                </main>
            </AdminLayout>
        )
    }
});
