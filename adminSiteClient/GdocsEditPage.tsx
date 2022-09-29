import React, { useContext, useEffect, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettings } from "./GdocsSettingsForm.js"
import { OwidArticle } from "../site/gdocs/owid-article.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import {
    Button,
    Col,
    Drawer,
    notification,
    Row,
    Space,
    Tag,
    Typography,
} from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"
import { useDebounceCallback } from "../site/hooks.js"
import { ErrorMessage, ErrorMessageType, getErrors } from "./gdocsValidation.js"
import { GdocsSaveButtons } from "./GdocsSaveButtons.js"
import { IconBadge } from "./IconBadge.js"
import { useGdocsStore } from "./GdocsStore.js"
import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons/faArrowsRotate"
import { GdocsSaveStatus } from "./GdocsSaveStatus.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { useUpdatePreviewContent, useGdocsChanged } from "./gdocsHooks.js"
import { GdocsMoreMenu } from "./GdocsMoreMenu.js"
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons/faAngleLeft"

export const GdocsEditPage = ({ match, history }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<OwidArticleType>()
    const [originalGdoc, setOriginalGdoc] = useState<OwidArticleType>()
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [errors, setErrors] = React.useState<ErrorMessage[]>()

    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

    const syncingError = useUpdatePreviewContent(id, !gdoc, setGdoc, admin)

    useEffect(() => {
        const fetchOriginalGdoc = async () => {
            const originalGdoc = (await admin.getJSON(
                `/api/gdocs/${id}`
            )) as OwidArticleType
            setOriginalGdoc(originalGdoc)
        }
        fetchOriginalGdoc()
    }, [admin, id])

    const hasChanges = useGdocsChanged(originalGdoc, gdoc)
    const hasWarnings =
        errors?.some((error) => error.type === ErrorMessageType.Warning) ??
        false
    const hasErrors =
        errors?.some((error) => error.type === ErrorMessageType.Error) ?? false

    const onUpdatePublicationStatus = async (published: boolean) => {
        if (!gdoc || (gdoc.published && hasErrors)) return
        const updatedGdoc = { ...gdoc, published }
        await store.update(updatedGdoc)

        setGdoc(updatedGdoc)
        setOriginalGdoc(updatedGdoc)
        openNotification(
            "success",
            "Document saved",
            <span>
                Your changes have been scheduled for publication.{" "}
                <a href="/admin/deploys">Check deploy progress</a>
            </span>
        )
    }

    const onDelete = async () => {
        if (!gdoc) return
        await store.delete(gdoc)
        history.push("/gdocs")
    }

    // Handle errors and validation status
    useEffect(() => {
        if (!gdoc) return
        const errors = getErrors(gdoc)
        setErrors(errors)
    }, [gdoc])

    const save = useDebounceCallback((gdoc: OwidArticleType) => {
        store.update(gdoc)
        setOriginalGdoc(gdoc)
    }, 2000)

    // Auto-save on change
    useEffect(() => {
        if (!gdoc || !hasChanges || gdoc.published) return
        save(gdoc)
    }, [save, gdoc, hasChanges])

    return gdoc ? (
        <AdminLayout title="Google Docs - Edit" noSidebar fixedNav={false}>
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
                                        Refreshing preview
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
                                onPublish={() =>
                                    onUpdatePublicationStatus(true)
                                }
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
                                onUnpublish={() =>
                                    onUpdatePublicationStatus(false)
                                }
                                onDelete={onDelete}
                            />
                        </Space>
                    </Col>
                </Row>
                <Drawer
                    title="Settings"
                    placement="bottom"
                    onClose={() => setSettingsOpen(false)}
                    open={isSettingsOpen}
                >
                    <GdocsSettings
                        gdoc={gdoc}
                        setGdoc={setGdoc}
                        errors={errors}
                    />
                </Drawer>

                <OwidArticle {...gdoc} />
            </main>
        </AdminLayout>
    ) : null
}

type NotificationType = "success" | "info" | ErrorMessageType
const openNotification = (
    type: NotificationType,
    title: string,
    description: React.ReactNode
) => {
    notification[type]({
        message: title,
        description,
    })
}
