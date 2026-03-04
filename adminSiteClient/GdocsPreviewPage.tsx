import { useCallback, useContext, useEffect, useRef, useState } from "react"
import * as React from "react"
import { AdminLayout } from "./AdminLayout.js"
import {
    GdocPostSettings,
    GdocInsightSettings,
    GdocHomepageSettings,
    GdocAuthorSettings,
    GdocAboutPageSettings,
    GdocAnnouncementSettings,
    GdocProfileSettings,
} from "./GdocsSettingsForms.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { getCanonicalUrl } from "@ourworldindata/components"
import {
    dayjs,
    GdocsContentSource,
    getOwidGdocFromJSON,
    OwidGdocJSON,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    slugify,
    OwidGdocType,
    OwidGdoc,
    Tippy,
    CreateTombstoneData,
    Url,
} from "@ourworldindata/utils"
import { Button, Col, Drawer, Row, Space, Switch, Tag, Typography } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faGear,
    faAngleLeft,
    faQuestionCircle,
} from "@fortawesome/free-solid-svg-icons"
import { match as tsMatch, P } from "ts-pattern"

import {
    useCountryProfileSelection,
    useGdocsChanged,
    useLightningUpdate,
} from "./gdocsHooks.js"
import { getErrors } from "./gdocsValidation.js"
import { GdocsSaveButtons } from "./GdocsSaveButtons.js"
import { useGdocsStore } from "./GdocsStoreContext.js"
import { IconBadge } from "./IconBadge.js"
import { GdocsMoreMenu } from "./GdocsMoreMenu.js"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { openSuccessNotification } from "./gdocsNotifications.js"
import { GdocsDiffButton } from "./GdocsDiffButton.js"
import { GdocsDiff } from "./GdocsDiff.js"
import {
    GdocsRecordsPreview,
    RecordsPreviewModeToggle,
    RecordsPreviewMode,
} from "./GdocsRecordsPreview.js"
import {
    BAKED_BASE_URL,
    PUBLISHED_AT_FORMAT,
} from "../settings/clientSettings.js"
import { RouteComponentProps } from "react-router-dom"
import * as R from "remeda"

interface GdocsMatchParams {
    id: string
}

export type GdocsMatchProps = RouteComponentProps<GdocsMatchParams>

export const GdocsPreviewPage = ({ match, history }: GdocsMatchProps) => {
    const { id } = match.params
    const [gdoc, setGdoc] = useState<{
        original?: OwidGdoc
        current?: OwidGdoc
    }>({ original: undefined, current: undefined })
    const originalGdoc = gdoc.original
    const currentGdoc = gdoc.current
    const setCurrentGdoc = (
        updater: (current: OwidGdoc | undefined) => OwidGdoc | undefined
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
    const [isRecordsOpen, setRecordsOpen] = useState(false)
    const [recordsPreviewMode, setRecordsPreviewMode] =
        useState<RecordsPreviewMode>("records")
    const [errors, setErrors] = React.useState<OwidGdocErrorMessage[]>()
    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

    const [isMobilePreviewActive, setIsMobilePreviewActive] = useState(false)
    const [acceptSuggestions, setAcceptSuggestions] = useState(false)

    // Only used when currentGdoc is a profile
    const { entitiesInScope, selectedEntity, setSelectedEntity } =
        useCountryProfileSelection(
            currentGdoc as OwidGdoc & {
                content: { type: OwidGdocType.Profile }
            }
        )

    const iframeRef = useRef<HTMLIFrameElement>(null)
    const iframeSrc = Url.fromURL(
        `/gdocs/${currentGdoc?.id}/preview#owid-document-root`
    ).setQueryParams({
        entity:
            currentGdoc?.content.type === OwidGdocType.Profile
                ? selectedEntity
                : undefined,
        acceptSuggestions: acceptSuggestions ? "true" : "false",
    })

    const fetchGdoc = useCallback(
        async (
            contentSource: GdocsContentSource,
            acceptSuggestions = false
        ) => {
            const queryParams = acceptSuggestions
                ? { acceptSuggestions: "true", contentSource }
                : { contentSource }
            const url = Url.fromURL(`/api/gdocs/${id}`).setQueryParams(
                queryParams
            )
            const json = await admin.requestJSON<OwidGdocJSON>(
                url.fullUrl,
                {},
                "GET",
                { onFailure: "continue" }
            )
            return getOwidGdocFromJSON(json)
        },
        [id, admin]
    )

    const handleError = useCallback((error: unknown) => {
        if (R.isPlainObject(error)) {
            console.log("Critical error", error)
            setCriticalErrorMessage(error.message as string)
        } else if (error instanceof Error) {
            console.log("Critical error", error)
            setCriticalErrorMessage(error.message)
        } else {
            console.log("Critical error", error)
            setCriticalErrorMessage(String(error))
        }
    }, [])

    useEffect(() => {
        setAcceptSuggestions(false)
        setGdoc((prev) =>
            prev.original === undefined && prev.current === undefined
                ? prev
                : { original: undefined, current: undefined }
        )
        setRecordsOpen(false)
    }, [id])

    // initialize
    useEffect(() => {
        let isMounted = true
        async function fetchLatestGdoc() {
            try {
                admin.loadingIndicatorSetting = "loading"
                const [original, current] = await Promise.all([
                    originalGdoc ?? fetchGdoc(GdocsContentSource.Internal),
                    fetchGdoc(GdocsContentSource.Gdocs, acceptSuggestions),
                ])
                if (!isMounted || !original || !current) return
                if (!current.slug && current.content.title) {
                    current.slug = slugify(current.content.title)
                }
                // Validate the gdoc type before setting it
                // so that we don't get ts-pattern runtime crashes
                const type = current.content.type
                const validTypes = Object.values(OwidGdocType)
                if (!type || !validTypes.includes(type)) {
                    throw new Error(
                        `Database record for Google Doc with id "${current.id}" has ${
                            !type
                                ? "no type"
                                : `invalid type "${type}". Valid types are: ${validTypes.join(", ")}`
                        }`
                    )
                }
                setGdoc({ original, current })
            } catch (error) {
                if (isMounted) {
                    handleError(error)
                }
            } finally {
                if (isMounted) {
                    admin.loadingIndicatorSetting = "off"
                }
            }
        }
        void fetchLatestGdoc()
        return () => {
            isMounted = false
        }
    }, [admin, acceptSuggestions, fetchGdoc, handleError, originalGdoc])

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
        publishedAt.setSeconds(0, 0)
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

    const onDelete = async (tombstone?: CreateTombstoneData) => {
        if (!currentGdoc) return
        await store.delete(currentGdoc, tombstone)
        history.push("/gdocs")
    }

    const toggleMobilePreview = () =>
        setIsMobilePreviewActive(
            (isMobilePreviewActive) => !isMobilePreviewActive
        )

    const onToggleAcceptSuggestions = (checked: boolean) => {
        setAcceptSuggestions(checked)
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
                            {currentGdoc.published &&
                                currentGdoc.publishedAt && (
                                    <>
                                        [
                                        {currentGdoc.publishedAt <=
                                        new Date() ? (
                                            <>
                                                <a
                                                    href={getCanonicalUrl(
                                                        BAKED_BASE_URL,
                                                        currentGdoc
                                                    )}
                                                >
                                                    View live
                                                </a>
                                                <Tippy
                                                    content="There might be a slight delay before content scheduled into the future becomes live."
                                                    placement="bottom"
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faQuestionCircle}
                                                    />
                                                </Tippy>
                                            </>
                                        ) : (
                                            `Scheduled for ${dayjs(currentGdoc.publishedAt).utc().format(PUBLISHED_AT_FORMAT)} (UTC)`
                                        )}
                                        ]
                                    </>
                                )}
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
                                disableButtons={acceptSuggestions}
                            />
                            <Space>
                                <Switch
                                    checked={acceptSuggestions}
                                    onChange={onToggleAcceptSuggestions}
                                    id="preview-suggestions"
                                />
                                <Tippy
                                    content={
                                        acceptSuggestions
                                            ? "Previewing with suggested edits accepted"
                                            : "Previewing without suggested edits"
                                    }
                                    placement="bottom"
                                >
                                    <label
                                        htmlFor="preview-suggestions"
                                        style={{
                                            marginBottom: 0,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Preview suggestions
                                    </label>
                                </Tippy>
                            </Space>
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
                                isMobilePreviewActive={isMobilePreviewActive}
                                toggleMobilePreview={toggleMobilePreview}
                                onOpenRecords={() => setRecordsOpen(true)}
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
                >
                    {tsMatch(currentGdoc)
                        .with(
                            {
                                content: {
                                    type: P.union(
                                        OwidGdocType.Article,
                                        OwidGdocType.TopicPage,
                                        OwidGdocType.LinearTopicPage,
                                        OwidGdocType.Fragment
                                    ),
                                },
                            },
                            (gdoc) => (
                                <GdocPostSettings
                                    gdoc={gdoc}
                                    setCurrentGdoc={(updatedGdoc) =>
                                        setCurrentGdoc(() => updatedGdoc)
                                    }
                                    errors={errors}
                                />
                            )
                        )
                        .with(
                            {
                                content: {
                                    type: OwidGdocType.DataInsight,
                                },
                            },
                            (gdoc) => (
                                <GdocInsightSettings
                                    gdoc={gdoc}
                                    setCurrentGdoc={(updatedGdoc) =>
                                        setCurrentGdoc(() => updatedGdoc)
                                    }
                                    errors={errors}
                                />
                            )
                        )
                        .with(
                            {
                                content: {
                                    type: OwidGdocType.Announcement,
                                },
                            },
                            (gdoc) => (
                                <GdocAnnouncementSettings
                                    gdoc={gdoc}
                                    setCurrentGdoc={(updatedGdoc) =>
                                        setCurrentGdoc(() => updatedGdoc)
                                    }
                                    errors={errors}
                                />
                            )
                        )
                        .with(
                            {
                                content: {
                                    type: OwidGdocType.Homepage,
                                },
                            },
                            (gdoc) => (
                                <GdocHomepageSettings
                                    gdoc={gdoc}
                                    errors={errors}
                                />
                            )
                        )
                        .with(
                            {
                                content: {
                                    type: OwidGdocType.Author,
                                },
                            },
                            (gdoc) => (
                                <GdocAuthorSettings
                                    gdoc={gdoc}
                                    setCurrentGdoc={(updatedGdoc) =>
                                        setCurrentGdoc(() => updatedGdoc)
                                    }
                                    errors={errors}
                                />
                            )
                        )
                        .with(
                            {
                                content: {
                                    type: OwidGdocType.AboutPage,
                                },
                            },
                            (gdoc) => (
                                <GdocAboutPageSettings
                                    gdoc={gdoc}
                                    setCurrentGdoc={(updatedGdoc) =>
                                        setCurrentGdoc(() => updatedGdoc)
                                    }
                                    errors={errors}
                                />
                            )
                        )
                        .with(
                            {
                                content: {
                                    type: OwidGdocType.Profile,
                                },
                            },
                            (gdoc) => (
                                <GdocProfileSettings
                                    gdoc={gdoc}
                                    setCurrentGdoc={(updatedGdoc) =>
                                        setCurrentGdoc(() => updatedGdoc)
                                    }
                                    errors={errors}
                                    selectedEntity={selectedEntity}
                                    setSelectedEntity={setSelectedEntity}
                                    entitiesInScope={entitiesInScope}
                                />
                            )
                        )
                        .with(P.any, () => (
                            <div>
                                Unknown gdoc type. Add a <strong>type</strong>{" "}
                                to the front-matter of this gdoc and reload this
                                page.
                            </div>
                        ))
                        .run()}
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
                <Drawer
                    placement="bottom"
                    size="large"
                    title="Index preview"
                    extra={
                        <RecordsPreviewModeToggle
                            mode={recordsPreviewMode}
                            onChange={setRecordsPreviewMode}
                        />
                    }
                    onClose={() => setRecordsOpen(false)}
                    open={isRecordsOpen}
                >
                    <GdocsRecordsPreview
                        gdocId={currentGdoc.id}
                        open={isRecordsOpen}
                        mode={recordsPreviewMode}
                    />
                </Drawer>

                <div className="iframe-container">
                    {/*
                        This uses the full SSR rendering pipeline. It is more accurate but comes
                        with an additional requests to the Google API and has a less polished
                        authoring experience at the moment (content flashes and scrolling position
                        resets on every change)
                    */}
                    <iframe
                        ref={iframeRef}
                        src={iframeSrc.fullUrl}
                        style={{
                            width: "100%",
                            border: "none",
                            maxWidth: isMobilePreviewActive ? 375 : undefined,
                        }}
                        // use `updatedAt` as a proxy for when database-level settings such as breadcrumbs have changed
                        // For profiles, also include selectedEntity so iframe reloads when entity changes
                        key={
                            currentGdoc.content.type === OwidGdocType.Profile
                                ? `${currentGdoc.revisionId}-${originalGdoc?.updatedAt}-${acceptSuggestions}-${selectedEntity ?? "default"}`
                                : `${currentGdoc.revisionId}-${originalGdoc?.updatedAt}-${acceptSuggestions}`
                        }
                    />
                </div>

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
