import React, { useContext, useEffect } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettings } from "./GdocsSettings.js"
import { OwidArticle } from "../site/gdocs/owid-article.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = React.useState<OwidArticleType>()

    const { admin } = useContext(AdminAppContext)
    useEffect(() => {
        const fetchGdoc = async () => {
            const gdoc = (await admin.getJSON(
                `/api/gdocs/${id}`
            )) as OwidArticleType
            setGdoc(gdoc)
        }
        fetchGdoc()
    }, [id, admin])

    return gdoc ? (
        <AdminLayout title="Google Docs - Edit">
            <main className="d-flex">
                <GdocsSettings gdoc={gdoc} setGdoc={setGdoc} />
                <div className="flex-grow-1">
                    <OwidArticle {...gdoc} />
                </div>
            </main>
        </AdminLayout>
    ) : null
}
