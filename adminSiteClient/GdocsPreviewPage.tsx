import React, { useContext, useEffect, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettingsForm } from "./GdocsSettingsForm.js"
import { OwidArticle } from "../site/gdocs/OwidArticle.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    OwidArticleType,
    OwidArticleTypeJSON,
    getArticleFromJSON,
} from "@ourworldindata/utils"
import { Button, Col, Drawer, Modal, Row, Space, Tag, Typography } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"

import { ErrorMessage, ErrorMessageType, getErrors } from "./gdocsValidation.js"
import { GdocsSaveButtons } from "./GdocsSaveButtons.js"
import { IconBadge } from "./IconBadge.js"
import { useGdocsStore } from "./GdocsStore.js"
import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons/faArrowsRotate"
import { GdocsSaveStatus } from "./GdocsSaveStatus.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import {
    useUpdatePreviewContent,
    useGdocsChanged,
    useAutoSaveDraft,
    useLightningUpdate,
} from "./gdocsHooks.js"
import { GdocsMoreMenu } from "./GdocsMoreMenu.js"
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons/faAngleLeft"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { openSuccessNotification } from "./gdocsNotifications.js"
import { DebugProvider } from "../site/gdocs/DebugContext.js"

export const GdocsPreviewPage = ({ match, history }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<OwidArticleType>()
    const [originalGdoc, setOriginalGdoc] = useState<OwidArticleType>()
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [errors, setErrors] = React.useState<ErrorMessage[]>()

    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

    const hasChanges = useGdocsChanged(originalGdoc, gdoc)
    const syncingError = useUpdatePreviewContent(id, gdoc, setGdoc, admin)
    const isLightningUpdate = useLightningUpdate(originalGdoc, gdoc, hasChanges)
    useAutoSaveDraft(gdoc, setOriginalGdoc, hasChanges)

    useEffect(() => {
        const fetchOriginalGdoc = async () => {
            const originalGdocJson = (await admin.getJSON(
                `/api/gdocs/${id}`
            )) as OwidArticleTypeJSON

            setOriginalGdoc(getArticleFromJSON(originalGdocJson))
        }
        fetchOriginalGdoc()
    }, [admin, id])

    const hasWarnings =
        errors?.some((error) => error.type === ErrorMessageType.Warning) ??
        false
    const hasErrors =
        errors?.some((error) => error.type === ErrorMessageType.Error) ?? false

    const confirmPublish = async () => {
        if (!gdoc) return

        Modal.confirm({
            title: "Are you sure you want to publish this article?",
            content:
                hasWarnings &&
                errors?.map((error, i) => <div key={i}>{error.message}</div>),
            okType: hasWarnings ? "danger" : "primary",
            okText: "Publish now",
            cancelText: "Cancel",
            onOk: doPublish,
        })
    }

    const doPublish = async () => {
        if (!gdoc) return
        const publishedGdoc = await store.publish(gdoc)

        setGdoc(publishedGdoc)
        setOriginalGdoc(publishedGdoc)
        openSuccessNotification()
    }

    const doUnpublish = async () => {
        if (!gdoc) return
        const unpublishedGdoc = await store.unpublish(gdoc)

        setGdoc(unpublishedGdoc)
        setOriginalGdoc(unpublishedGdoc)
        openSuccessNotification()
    }

    const onDelete = async () => {
        if (!gdoc) return
        await store.delete(gdoc)
        history.push("/gdocs")
    }

    const onSettingsClose = () => {
        setSettingsOpen(false)
    }

    // Handle errors and validation status
    useEffect(() => {
        if (!gdoc) return
        const errors = getErrors(gdoc)
        setErrors(errors)
    }, [gdoc])

    return gdoc ? (
        <AdminLayout
            title={`Previewing ${gdoc.content.title}`}
            noSidebar
            fixedNav={false}
        >
            <main className="GdocsEditPage">
                <Row
                    justify="space-between"
                    align="middle"
                    gutter={[16, 8]}
                    className={`p-3 admin-bar ${
                        gdoc.published ? "published" : "draft"
                    }`}
                >
                    <Col flex={1}>
                        <Space>
                            <Button onClick={() => history.push("/gdocs")}>
                                <FontAwesomeIcon icon={faAngleLeft} />
                            </Button>
                            <Typography.Title className="mb-0" level={4}>
                                {gdoc.content.title}
                            </Typography.Title>
                            [ <GdocsEditLink gdoc={gdoc} /> ]
                            <div>
                                {!gdoc.published && (
                                    <Tag color="default">Draft</Tag>
                                )}
                                {syncingError ? (
                                    <Tag
                                        icon={
                                            <FontAwesomeIcon
                                                icon={faExclamationTriangle}
                                            />
                                        }
                                        color="warning"
                                    >
                                        Syncing error, retrying...
                                    </Tag>
                                ) : (
                                    <Tag
                                        icon={
                                            <FontAwesomeIcon
                                                icon={faArrowsRotate}
                                            />
                                        }
                                        color="success"
                                    >
                                        preview
                                    </Tag>
                                )}
                            </div>
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            {!gdoc.published && (
                                <span className="mr-2">
                                    <GdocsSaveStatus hasChanges={hasChanges} />
                                </span>
                            )}
                            <GdocsSaveButtons
                                published={gdoc.published}
                                hasErrors={hasErrors}
                                hasWarnings={hasWarnings}
                                hasChanges={hasChanges}
                                isLightningUpdate={isLightningUpdate}
                                onPublish={confirmPublish}
                            />
                            <IconBadge
                                status={
                                    hasErrors
                                        ? ErrorMessageType.Error
                                        : hasWarnings
                                        ? ErrorMessageType.Warning
                                        : null
                                }
                            >
                                <Button onClick={() => setSettingsOpen(true)}>
                                    <FontAwesomeIcon icon={faGear} />
                                </Button>
                            </IconBadge>
                            <GdocsMoreMenu
                                gdoc={gdoc}
                                onUnpublish={doUnpublish}
                                onDelete={onDelete}
                            />
                        </Space>
                    </Col>
                </Row>
                <Drawer
                    title="Settings"
                    placement="right"
                    size="large"
                    onClose={onSettingsClose}
                    open={isSettingsOpen}
                    extra={
                        <Button type="primary" onClick={onSettingsClose}>
                            Done
                        </Button>
                    }
                >
                    <GdocsSettingsForm
                        gdoc={gdoc}
                        setGdoc={setGdoc}
                        errors={errors}
                    />
                </Drawer>
                <DebugProvider>
                    <OwidArticle {...gdoc} />
                </DebugProvider>
            </main>
        </AdminLayout>
    ) : null
}
