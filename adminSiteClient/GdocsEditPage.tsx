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
import { Button, Col, Drawer, Row, Space, Tag, Typography } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"
import { useInterval } from "../site/hooks.js"
import { faExclamationCircle } from "@fortawesome/free-solid-svg-icons/faExclamationCircle"
import { ErrorMessage, ErrorMessageType, getErrors } from "./gdocsValidation.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons/faExclamationTriangle"
import { faCircle } from "@fortawesome/free-solid-svg-icons/faCircle"
import { GdocsSaveButtons } from "./GdocsSaveButtons.js"
import { isEqual } from "../clientUtils/Util.js"

export const GdocsEditPage = ({ match }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<OwidArticleType>()
    const [originalGdoc, setOriginalGdoc] = useState<OwidArticleType>()
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [syncingError, setSyncingError] = React.useState(false)
    const [errors, setErrors] = React.useState<ErrorMessage[]>()

    const { admin } = useContext(AdminAppContext)

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

    const onSubmit = async (
        e: React.MouseEvent<HTMLElement>,
        overridePatch?: GdocsPatch[]
    ) => {
        if (!gdoc || (gdoc.published && hasErrors)) return

        const gdocsPatches: GdocsPatch[] = [
            { op: GdocsPatchOp.Update, property: "title", payload: gdoc.title },
            { op: GdocsPatchOp.Update, property: "slug", payload: gdoc.slug },
            {
                op: GdocsPatchOp.Update,
                property: "content",
                payload: gdoc.content,
            },
            ...(overridePatch ?? []),
        ]

        await admin.requestJSON(`/api/gdocs/${gdoc.id}`, gdocsPatches, "PATCH")
        setSettingsOpen(false)
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
                                onSubmit={onSubmit}
                            />
                            <Button
                                onClick={() => setSettingsOpen(true)}
                                className="settings-toggle"
                            >
                                <FontAwesomeIcon icon={faGear} />

                                {hasErrors ? (
                                    <FontAwesomeIcon
                                        icon={faExclamationCircle}
                                        color="red"
                                        style={{
                                            position: "absolute",
                                            top: "-0.5em",
                                            right: "-0.5em",
                                        }}
                                    />
                                ) : hasWarnings ? (
                                    <FontAwesomeIcon
                                        icon={faExclamationTriangle}
                                        color="orange"
                                        style={{
                                            position: "absolute",
                                            top: "-0.5em",
                                            right: "-0.5em",
                                        }}
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
                        saveButtons={
                            <GdocsSaveButtons
                                published={gdoc.published}
                                hasErrors={hasErrors}
                                hasWarnings={hasWarnings}
                                hasChanges={hasChanges}
                                onSubmit={onSubmit}
                            />
                        }
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
