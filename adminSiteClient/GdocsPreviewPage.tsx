import React, { useCallback, useContext, useEffect, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettingsForm } from "./GdocsSettingsForm.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    checkIsPlainObjectWithGuard,
    GdocsContentSource,
    getArticleFromJSON,
    OwidArticleType,
    OwidArticleTypeJSON,
} from "@ourworldindata/utils"
import { Button, Col, Drawer, Row, Space, Tag, Typography } from "antd"
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
    useGdocsChanged,
    useAutoSaveDraft,
    useLightningUpdate,
} from "./gdocsHooks.js"
import { GdocsMoreMenu } from "./GdocsMoreMenu.js"
import { faAngleLeft } from "@fortawesome/free-solid-svg-icons/faAngleLeft"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { openSuccessNotification } from "./gdocsNotifications.js"
import { GdocsDiffButton } from "./GdocsDiffButton.js"
import { GdocsDiff } from "./GdocsDiff.js"
import { useInterval } from "../site/hooks.js"

export const GdocsPreviewPage = ({ match, history }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<{
        original?: OwidArticleType
        current?: OwidArticleType
    }>({ original: undefined, current: undefined })
    const originalGdoc = gdoc.original
    const currentGdoc = gdoc.current
    const setOriginalGdoc = (original?: OwidArticleType) =>
        setGdoc({ original, current: gdoc.current })
    const setCurrentGdoc = (current: OwidArticleType | undefined) =>
        setGdoc({ original: gdoc.original, current })
    const hasChanges = useGdocsChanged(originalGdoc, currentGdoc)
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [hasSyncingError, setHasSyncingError] = useState(false)
    const [criticalErrorMessage, setCriticalErrorMessage] = useState<
        undefined | string
    >()
    const [isDiffOpen, setDiffOpen] = useState(false)
    const [errors, setErrors] = React.useState<ErrorMessage[]>()
    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

    const fetchGdoc = useCallback(
        (contentSource: GdocsContentSource) =>
            admin
                .requestJSON<OwidArticleTypeJSON>(
                    `/api/gdocs/${id}?contentSource=${contentSource}`,
                    {},
                    "GET",
                    { onFailure: "continue" }
                )
                .then(getArticleFromJSON),
        [id, admin]
    )

    const handleError = useCallback((error: unknown) => {
        if (checkIsPlainObjectWithGuard(error) && error.status === 500) {
            console.log("Critical error", error)
            setCriticalErrorMessage(error.message as string)
        } else {
            console.log("Syncing error", error)
            setHasSyncingError(true)
        }
    }, [])

    // initialise
    useEffect(() => {
        if (!originalGdoc) {
            Promise.all([
                fetchGdoc(GdocsContentSource.Internal),
                fetchGdoc(GdocsContentSource.Gdocs),
            ])
                .then(([original, current]) => {
                    admin.loadingIndicatorSetting = "off"
                    setGdoc({ original, current })
                })
                .catch(handleError)
        }
    }, [originalGdoc, fetchGdoc, handleError, admin])

    // synchronise content every 5 seconds
    useInterval(() => {
        if (currentGdoc) {
            fetchGdoc(GdocsContentSource.Gdocs)
                .then((gdoc) => {
                    setCurrentGdoc(gdoc)
                    setHasSyncingError(false)
                })
                .catch(handleError)
        }
    }, 5000)

    // autosave
    useAutoSaveDraft(currentGdoc, setOriginalGdoc, hasChanges)

    const isLightningUpdate = useLightningUpdate(
        originalGdoc,
        currentGdoc,
        hasChanges
    )

    const hasWarnings =
        errors?.some((error) => error.type === ErrorMessageType.Warning) ??
        false

    const hasErrors =
        errors?.some((error) => error.type === ErrorMessageType.Error) ?? false

    const doPublish = async () => {
        if (!currentGdoc) return
        const publishedGdoc = await store.publish(currentGdoc)
        setGdoc({ original: publishedGdoc, current: publishedGdoc })
        openSuccessNotification()
    }

    const doUnpublish = async () => {
        if (!currentGdoc) return
        const unpublishedGdoc = await store.unpublish(currentGdoc)
        setGdoc({ original: unpublishedGdoc, current: unpublishedGdoc })
        openSuccessNotification()
    }

    const onDelete = async () => {
        if (!currentGdoc) return
        await store.delete(currentGdoc)
        history.push("/gdocs")
    }

    const onSettingsClose = () => {
        setSettingsOpen(false)
    }

    const onDiffClose = () => {
        setDiffOpen(false)
    }

    // Handle errors and validation status
    useEffect(() => {
        if (!currentGdoc) return
        const errors = getErrors(currentGdoc)
        setErrors(errors)
    }, [currentGdoc])

    if (criticalErrorMessage) {
        return (
            <AdminLayout title="Preview error" noSidebar fixedNav={false}>
                <main className="GdocsEditPage">
                    <div className="GdocsEditPage__error-container">
                        <p>Something went wrong preparing the article.</p>
                        <pre>{criticalErrorMessage}</pre>
                        <p>
                            Ask a dev for help if necessary, and reload this
                            page when it's fixed 🙂
                        </p>
                    </div>
                </main>
            </AdminLayout>
        )
    }

    return currentGdoc ? (
        <AdminLayout
            title={`Previewing ${currentGdoc.content.title}`}
            noSidebar
            fixedNav={false}
        >
            <main className="GdocsEditPage">
                <Row
                    justify="space-between"
                    align="middle"
                    gutter={[0, 8]}
                    className={`p-3 admin-bar ${
                        currentGdoc.published ? "published" : "draft"
                    }`}
                >
                    <Col flex={1}>
                        <Space>
                            <Button onClick={() => history.push("/gdocs")}>
                                <FontAwesomeIcon icon={faAngleLeft} />
                            </Button>
                            <Typography.Title className="mb-0" level={4}>
                                {currentGdoc.content.title}
                            </Typography.Title>
                            [ <GdocsEditLink gdocId={currentGdoc.googleId} /> ]
                            <div>
                                {!currentGdoc.published && (
                                    <Tag color="default">Draft</Tag>
                                )}
                                {hasSyncingError ? (
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
                            {!currentGdoc?.published && (
                                <span className="mr-2">
                                    <GdocsSaveStatus hasChanges={hasChanges} />
                                </span>
                            )}
                            <GdocsSaveButtons
                                published={currentGdoc.published}
                                originalGdoc={originalGdoc}
                                currentGdoc={currentGdoc}
                                errors={errors}
                                hasErrors={hasErrors}
                                hasWarnings={hasWarnings}
                                hasChanges={hasChanges}
                                isLightningUpdate={isLightningUpdate}
                                setDiffOpen={setDiffOpen}
                                doPublish={doPublish}
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
                                gdoc={currentGdoc}
                                onDebug={() => setDiffOpen(true)}
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
                        gdoc={currentGdoc}
                        setGdoc={setCurrentGdoc}
                        errors={errors}
                    />
                </Drawer>
                <Drawer
                    placement="bottom"
                    size="large"
                    open={isDiffOpen}
                    onClose={onDiffClose}
                    extra={
                        <Button type="primary" onClick={onDiffClose}>
                            Done
                        </Button>
                    }
                >
                    <GdocsDiff
                        originalGdoc={originalGdoc}
                        currentGdoc={currentGdoc}
                    />
                </Drawer>

                {/*
                    This uses the full SSR rendering pipeline. It is more accurate but comes
                    with an additional requests to the Google API and has a less polished
                    authoring experience at the moment (content flashes and scrolling position
                    resets on every change)
                */}
                <iframe
                    src={`/gdocs/${currentGdoc.googleId}/preview#owid-article-root`}
                    style={{ width: "100%", border: "none" }}
                    key={currentGdoc.revisionId}
                />

                {currentGdoc.published && (
                    <div
                        className="position-fixed m-3"
                        style={{ bottom: 0, right: 0 }}
                    >
                        <GdocsDiffButton
                            hasChanges={hasChanges}
                            setDiffOpen={setDiffOpen}
                        />
                    </div>
                )}
            </main>
        </AdminLayout>
    ) : null
}
