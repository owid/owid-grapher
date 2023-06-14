import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { AdminLayout } from "./AdminLayout.js"
import { GdocsMatchProps } from "./GdocsIndexPage.js"
import { GdocsSettingsForm } from "./GdocsSettingsForm.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    checkIsPlainObjectWithGuard,
    GdocsContentSource,
    getOwidGdocFromJSON,
    OwidGdocInterface,
    OwidGdocJSON,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    slugify,
} from "@ourworldindata/utils"
import { Button, Col, Drawer, Row, Space, Tag, Typography } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faGear,
    faArrowsRotate,
    faExclamationTriangle,
    faAngleLeft,
} from "@fortawesome/free-solid-svg-icons"

import { getErrors } from "./gdocsValidation.js"
import { GdocsSaveButtons } from "./GdocsSaveButtons.js"
import { IconBadge } from "./IconBadge.js"
import { useGdocsStore } from "./GdocsStore.js"
import { useGdocsChanged, useLightningUpdate } from "./gdocsHooks.js"
import { GdocsMoreMenu } from "./GdocsMoreMenu.js"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { openSuccessNotification } from "./gdocsNotifications.js"
import { GdocsDiffButton } from "./GdocsDiffButton.js"
import { GdocsDiff } from "./GdocsDiff.js"
import { useInterval } from "../site/hooks.js"

export const GdocsPreviewPage = ({ match, history }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<{
        original?: OwidGdocInterface
        current?: OwidGdocInterface
    }>({ original: undefined, current: undefined })
    const originalGdoc = gdoc.original
    const currentGdoc = gdoc.current
    const setCurrentGdoc = (current: OwidGdocInterface | undefined) => {
        setGdoc({ original: originalGdoc, current })
    }
    const hasChanges = useGdocsChanged(originalGdoc, currentGdoc)
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [hasSyncingError, setHasSyncingError] = useState(false)
    const [criticalErrorMessage, setCriticalErrorMessage] = useState<
        undefined | string
    >()
    const [isDiffOpen, setDiffOpen] = useState(false)
    const [errors, setErrors] = React.useState<OwidGdocErrorMessage[]>()
    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()
    const [iframeScrollY, setIframeScrollY] = useState<number | undefined>()
    // Cancel all other requests in progress (most likely just the automatic fetch)
    const cancelAllRequests = useMemo(
        () => () =>
            admin.currentRequestAbortControllers.forEach((abortController) => {
                abortController.abort()
            }),
        [admin]
    )

    const iframeRef = useRef<HTMLIFrameElement>(null)

    const fetchGdoc = useCallback(
        (contentSource: GdocsContentSource) =>
            admin
                .requestJSON<OwidGdocJSON>(
                    `/api/gdocs/${id}?contentSource=${contentSource}`,
                    {},
                    "GET",
                    { onFailure: "continue" }
                )
                .then(getOwidGdocFromJSON),
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
        async function fetchGdocs() {
            try {
                // Fetching in sequence instead of with Promise.all to prevent race conditions
                // if images need to be uploaded from the original
                const original = await fetchGdoc(GdocsContentSource.Internal)
                const current = await fetchGdoc(GdocsContentSource.Gdocs)
                admin.loadingIndicatorSetting = "off"
                setGdoc({ original, current })
            } catch (error) {
                handleError(error)
            }
        }
        if (!originalGdoc) {
            fetchGdocs()
        }
    }, [originalGdoc, fetchGdoc, handleError, admin])

    // synchronise content every 5 seconds
    useInterval(async () => {
        if (currentGdoc) {
            const latestGdoc = await fetchGdoc(GdocsContentSource.Gdocs)

            // Save the scroll position of the iframe to restore it after the
            // refresh. The condition is here to prevent firefox from
            // calculating the scroll position on page load, which somehow results in a
            // wrong value (likely at the bottom).
            if (latestGdoc.revisionId !== currentGdoc.revisionId) {
                setIframeScrollY(iframeRef.current?.contentWindow?.scrollY)
            }

            setCurrentGdoc({
                ...latestGdoc,
                slug: currentGdoc.slug,
                published: currentGdoc.published,
                publishedAt: currentGdoc.publishedAt,
                publicationContext: currentGdoc.publicationContext,
            })
        }
    }, 5000)

    const onIframeLoad = () => {
        if (!iframeScrollY) return
        // scroll the iframe to the position it was at before the refresh
        iframeRef.current?.contentWindow?.scrollTo({
            top: iframeScrollY,
        })
    }

    const isLightningUpdate = useLightningUpdate(
        originalGdoc,
        currentGdoc,
        hasChanges
    )

    const hasWarnings =
        errors?.some(
            (error) => error.type === OwidGdocErrorMessageType.Warning
        ) ?? false

    const hasErrors =
        errors?.some(
            (error) => error.type === OwidGdocErrorMessageType.Error
        ) ?? false

    const doPublish = async () => {
        if (!currentGdoc) return
        cancelAllRequests()
        // set to today if not specified
        const publishedAt = currentGdoc.publishedAt ?? new Date()
        const slug = currentGdoc.slug ?? slugify(`${currentGdoc.content.title}`)
        const publishedGdoc = await store.publish({
            ...currentGdoc,
            publishedAt,
            slug,
        })
        setGdoc({ original: publishedGdoc, current: publishedGdoc })
        openSuccessNotification()
    }

    const doUnpublish = async () => {
        if (!currentGdoc) return
        cancelAllRequests()
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
                            [ <GdocsEditLink gdocId={currentGdoc.id} /> ]
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
                                        ? OwidGdocErrorMessageType.Error
                                        : hasWarnings
                                        ? OwidGdocErrorMessageType.Warning
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
                        setCurrentGdoc={setCurrentGdoc}
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
                    ref={iframeRef}
                    onLoad={onIframeLoad}
                    src={`/gdocs/${currentGdoc.id}/preview#owid-document-root`}
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
