import React, { useCallback, useContext, useEffect, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettings } from "./GdocsSettingsForm.js"
import { OwidArticle } from "../site/gdocs/owid-article.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    GdocsContentSource,
    GdocsPatch,
    GdocsPatchOp,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
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
import { useInterval } from "../site/hooks.js"
import { ErrorMessage, ErrorMessageType, getErrors } from "./gdocsValidation.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faCircle } from "@fortawesome/free-solid-svg-icons/faCircle"
import { GdocsSaveButtons } from "./GdocsSaveButtons.js"
import { isEqual } from "../clientUtils/Util.js"
import { ButtonBadge } from "./ButtonBadge.js"
import { useGdocsStore } from "./GdocsStore.js"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<OwidArticleType>()
    const [originalGdoc, setOriginalGdoc] = useState<OwidArticleType>()
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [syncingError, setSyncingError] = React.useState(false)
    const [errors, setErrors] = React.useState<ErrorMessage[]>()

    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

    const updatePreview = useCallback(async () => {
        try {
            const draftGdoc = (await admin.requestJSON(
                `/api/gdocs/${id}?contentSource=${GdocsContentSource.Gdocs}`,
                {},
                "GET",
                { onFailure: "continue" }
            )) as OwidArticleType
            setGdoc((currGdoc) =>
                currGdoc
                    ? { ...currGdoc, content: draftGdoc.content }
                    : draftGdoc
            )
            setSyncingError(false)
        } catch (e) {
            console.log(e)
            setSyncingError(true)
        }
    }, [admin, id])

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

    const onPublish = async () => {
        if (!gdoc || (gdoc.published && hasErrors)) return
        const publishedGdoc = { ...gdoc, published: true }
        await store.update(publishedGdoc, [
            {
                op: GdocsPatchOp.Update,
                property: "published",
                payload: true,
            },
        ])

        setGdoc(publishedGdoc)
        setOriginalGdoc(publishedGdoc)
        openNotification(
            "success",
            "Document saved",
            <span>
                Your changes have been scheduled for publication.{" "}
                <a href="/admin/deploys">Check deploy progress</a>
            </span>
        )
    }

    // Fetch the gdoc on mount
    useEffect(() => {
        updatePreview()
        admin.loadingIndicatorSetting = "off"
    }, [admin, updatePreview])

    // Sync content every 5 seconds
    useInterval(updatePreview, 5000)

    // Handle errors and validation status
    useEffect(() => {
        if (!gdoc) return
        const errors = getErrors(gdoc)
        setErrors(errors)
    }, [gdoc])

    // Auto-save on change
    useEffect(() => {
        if (!gdoc || !hasChanges || gdoc.published) return
        console.log("saving")
        store.update(gdoc)
        setOriginalGdoc(gdoc)
    }, [store, gdoc, hasChanges])

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
                        <div className="d-flex align-items-center">
                            <Typography.Title
                                editable={{
                                    onChange: (title) =>
                                        setGdoc({ ...gdoc, title }),
                                }}
                                style={{
                                    marginBottom: 0,
                                }}
                                level={4}
                            >
                                {gdoc.title}
                            </Typography.Title>
                            {gdoc.published ? (
                                <Tag color="success">live</Tag>
                            ) : (
                                <Tag color="default">Draft</Tag>
                            )}
                        </div>
                    </Col>
                    <Col>
                        <Space>
                            <span className="mr-2">
                                {syncingError ? (
                                    <span className="warning">
                                        <span>Syncing error, retrying...</span>{" "}
                                        <FontAwesomeIcon
                                            icon={faExclamationTriangle}
                                            color="orange"
                                        />
                                    </span>
                                ) : (
                                    <span className="success">
                                        Content syncing{" "}
                                        <FontAwesomeIcon
                                            icon={faCircle}
                                            size="xs"
                                        />
                                    </span>
                                )}
                            </span>
                            <GdocsSaveButtons
                                published={gdoc.published}
                                hasErrors={hasErrors}
                                hasWarnings={hasWarnings}
                                hasChanges={hasChanges}
                                onPublish={onPublish}
                            />
                            <Button onClick={() => setSettingsOpen(true)}>
                                <FontAwesomeIcon icon={faGear} />
                                {hasErrors ? (
                                    <ButtonBadge
                                        status={ErrorMessageType.Error}
                                    />
                                ) : hasWarnings ? (
                                    <ButtonBadge
                                        status={ErrorMessageType.Warning}
                                    />
                                ) : null}
                            </Button>
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

export const useGdocsChanged = (
    prevGdoc: OwidArticleType | undefined,
    nextGdoc: OwidArticleType | undefined
) => {
    const [hasChanges, setHasChanges] = useState(false)

    useEffect(() => {
        setHasChanges(!isEqual(prevGdoc, nextGdoc))
    }, [prevGdoc, nextGdoc])

    return hasChanges
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
