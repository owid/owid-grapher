import React, {
    useCallback,
    useContext,
    useEffect,
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
    OwidGdocPostInterface,
    OwidGdocJSON,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    slugify,
} from "@ourworldindata/utils"
import { Button, Col, Drawer, Row, Space, Tag, Typography } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faGear, faAngleLeft } from "@fortawesome/free-solid-svg-icons"

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

export const GdocsPreviewPage = ({ match, history }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<{
        original?: OwidGdocPostInterface
        current?: OwidGdocPostInterface
    }>({ original: undefined, current: undefined })
    const originalGdoc = gdoc.original
    const currentGdoc = gdoc.current
    const setCurrentGdoc = (
        updater: (
            current: OwidGdocPostInterface | undefined
        ) => OwidGdocPostInterface | undefined
    ) => {
        setGdoc(({ original, current }) => ({
            original,
            current: updater(current),
        }))
    }
    const hasChanges = useGdocsChanged(originalGdoc, currentGdoc)
    const [isSettingsOpen, setSettingsOpen] = useState(false)
    const [criticalErrorMessage, setCriticalErrorMessage] = useState<
        undefined | string
    >()
    const [isDiffOpen, setDiffOpen] = useState(false)
    const [errors, setErrors] = React.useState<OwidGdocErrorMessage[]>()
    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

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

    const saveDraft = async () => {
        if (!currentGdoc) return

        if (currentGdoc.published)
            throw new Error("Cannot save a published doc as a draft")

        const updatedGdoc = await store.update(currentGdoc)
        setGdoc({ original: updatedGdoc, current: updatedGdoc })
        openSuccessNotification("draft")
    }

    const doPublish = async () => {
        if (!currentGdoc) return
        // set to today if not specified
        const publishedAt = currentGdoc.publishedAt ?? new Date()
        const slug = currentGdoc.slug || slugify(`${currentGdoc.content.title}`)
        const publishedGdoc = await store.publish({
            ...currentGdoc,
            publishedAt,
            slug,
        })
        setGdoc({ original: publishedGdoc, current: publishedGdoc })
        openSuccessNotification("published")
    }

    const doUnpublish = async () => {
        if (!currentGdoc) return
        const unpublishedGdoc = await store.unpublish(currentGdoc)
        setGdoc({ original: unpublishedGdoc, current: unpublishedGdoc })
        openSuccessNotification("unpublished")
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
                        <p>
                            Something went wrong preparing the article{" "}
                            <GdocsEditLink gdocId={id} />
                        </p>

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
                                saveDraft={saveDraft}
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
                        setCurrentGdoc={(updatedGdoc) =>
                            setCurrentGdoc(() => updatedGdoc)
                        }
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
                    src={`/gdocs/${currentGdoc.id}/preview#owid-document-root`}
                    style={{ width: "100%", border: "none" }}
                    // use `updatedAt` as a proxy for when database-level settings such as breadcrumbs have changed
                    key={`${currentGdoc.revisionId}-${originalGdoc?.updatedAt}`}
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
