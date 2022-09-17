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
import { Button, Col, Drawer, Row, Space, Switch, Typography } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"
import { faRotate } from "@fortawesome/free-solid-svg-icons/faRotate"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { useInterval } from "../site/hooks.js"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<OwidArticleType>()
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isContentSyncing, setIsContentSyncing] = useState(false)

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
                <Row justify="space-between" className="m-3">
                    <Col flex={1}>
                        <Typography.Title
                            editable={{
                                onChange: (title) =>
                                    setGdoc({ ...gdoc, title }),
                            }}
                            style={{ marginBottom: 0 }}
                            level={4}
                        >
                            {gdoc.title}
                        </Typography.Title>
                    </Col>
                    <Col>
                        <Space>
                            <span>
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
                            </span>
                            <Button type="primary">Publish</Button>
                        </Space>
                    </Col>
                </Row>
                {/* <Route
                    path={`${match.path}/settings`}
                    render={() => {
                        return ( */}
                <Drawer
                    title="Settings"
                    placement="bottom"
                    onClose={() => setIsSettingsOpen(false)}
                    open={isSettingsOpen}
                >
                    <GdocsSettings gdoc={gdoc} setGdoc={setGdoc} />
                </Drawer>
                {/* )
                    }}
                /> */}

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
