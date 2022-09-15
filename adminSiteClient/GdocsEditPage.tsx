import React, { useCallback, useContext, useEffect, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettings } from "./GdocsSettingsForm.js"
import { OwidArticle } from "../site/gdocs/owid-article.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    GdocsContentSource,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import { Button, Drawer, PageHeader, Switch } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"
import { faRotate } from "@fortawesome/free-solid-svg-icons/faRotate"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { useInterval } from "../site/hooks.js"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<OwidArticleType>()
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isContentSyncing, setIsContentSyncing] = React.useState(true)

    const { admin } = useContext(AdminAppContext)

    const fetchGdoc = useCallback(async () => {
        const draftGdoc = (await admin.getJSON(
            `/api/gdocs/${id}?contentSource=${GdocsContentSource.Gdocs}`
        )) as OwidArticleType
        setGdoc((currGdoc) =>
            currGdoc ? { ...currGdoc, content: draftGdoc.content } : draftGdoc
        )
    }, [id, admin])

    // First load
    useEffect(() => {
        fetchGdoc()
        admin.loadingIndicatorSetting = "off"
    }, [admin, fetchGdoc])

    // Sync content every 5 seconds
    useInterval(fetchGdoc, isContentSyncing ? 5000 : null)

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
                        <span key="1">
                            {isContentSyncing ? "Syncing" : "Paused"}{" "}
                            <Switch
                                checked={isContentSyncing}
                                checkedChildren={
                                    <FontAwesomeIcon icon={faRotate} />
                                }
                                unCheckedChildren={
                                    <FontAwesomeIcon icon={faPause} />
                                }
                                onChange={(checked) =>
                                    setIsContentSyncing(checked)
                                }
                            />
                        </span>,
                        <Button key="2" type="primary">
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
