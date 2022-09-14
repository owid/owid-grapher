import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettings } from "./GdocsSettings.js"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    return (
        <AdminLayout title="Google Docs - Edit">
            <main>
                <div>
                    <GdocsSettings id={match.params.id} />
                </div>
                <div></div>
            </main>
        </AdminLayout>
    )
}
