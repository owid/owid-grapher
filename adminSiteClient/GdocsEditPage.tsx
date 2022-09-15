import React, { useContext, useEffect } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettings } from "./GdocsSettingsForm.js"
import { OwidArticle } from "../site/gdocs/owid-article.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { Button, Drawer, PageHeader, Switch, Tag } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = React.useState<OwidArticleType>()
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)

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
        <AdminLayout title="Google Docs - Edit" noSidebar>
            <main className="GdocsEditPage">
                <PageHeader
                    title={gdoc.title}
                    subTitle={
                        <Button
                            type="default"
                            size="small"
                            onClick={() => setIsSettingsOpen(true)}
                        >
                            Edit title
                        </Button>
                    }
                    className="site-page-header"
                    // tags={<Tag color="blue">Live</Tag>}
                    extra={[
                        // <Switch key="2" defaultChecked />,
                        <Button key="1" type="primary">
                            Publish
                        </Button>,
                        //   <DropdownMenu key="more" />,
                    ]}
                    // breadcrumb={{ routes }}
                ></PageHeader>
                <Drawer
                    title="Settings"
                    placement="right"
                    onClose={() => setIsSettingsOpen(false)}
                    visible={isSettingsOpen}
                >
                    <GdocsSettings gdoc={gdoc} setGdoc={setGdoc} />
                </Drawer>

                <OwidArticle {...gdoc} />
                <Button
                    type="primary"
                    onClick={() => setIsSettingsOpen(true)}
                    className="settings-toggle"
                >
                    <FontAwesomeIcon icon={faGear} />
                </Button>
            </main>
        </AdminLayout>
    ) : null
}
