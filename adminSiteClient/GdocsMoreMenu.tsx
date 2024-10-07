import * as React from "react"
import { useState } from "react"
import { Dropdown, Button, Modal, Form, Checkbox, Input } from "antd"
import {
    faEllipsisVertical,
    faTrash,
    faXmark,
    faBug,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    CreateTombstoneData,
    GDOCS_URL_PLACEHOLDER,
    GDOCS_BASE_URL,
    gdocUrlRegex,
    OwidGdoc,
    Url,
    omit,
} from "@ourworldindata/utils"

import { DEFAULT_TOMBSTONE_REASON } from "../site/SiteConstants.js"

enum GdocsMoreMenuAction {
    Debug = "debug",
    Unpublish = "unpublish",
    Delete = "delete",
}

export const GdocsMoreMenu = ({
    gdoc,
    onDebug,
    onUnpublish,
    onDelete,
}: {
    gdoc: OwidGdoc
    onDebug: VoidFunction
    onUnpublish: VoidFunction
    onDelete: (tombstone?: CreateTombstoneData) => Promise<void>
}) => {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

    const confirmUnpublish = () => {
        Modal.confirm({
            title: "Are you sure you want to unpublish this article?",
            content: "The article will no longer be visible to the public.",
            okText: "Unpublish",
            okType: "danger",
            cancelText: "Cancel",
            onOk() {
                onUnpublish()
            },
            maskClosable: true,
        })
    }

    return (
        <>
            <Dropdown
                trigger={["click"]}
                menu={{
                    onClick: ({ key }) => {
                        switch (key) {
                            case GdocsMoreMenuAction.Debug:
                                onDebug()
                                break
                            case GdocsMoreMenuAction.Unpublish:
                                confirmUnpublish()
                                break
                            case GdocsMoreMenuAction.Delete:
                                setIsDeleteModalOpen(true)
                                break
                        }
                    },
                    items: [
                        {
                            key: GdocsMoreMenuAction.Debug,
                            label: "Debug",
                            icon: <FontAwesomeIcon icon={faBug} />,
                        },
                        {
                            key: GdocsMoreMenuAction.Unpublish,
                            label: "Unpublish",
                            danger: gdoc.published,
                            disabled: !gdoc.published,
                            icon: <FontAwesomeIcon icon={faXmark} />,
                        },
                        {
                            key: GdocsMoreMenuAction.Delete,
                            label: "Delete",
                            danger: true,
                            icon: <FontAwesomeIcon icon={faTrash} />,
                        },
                    ],
                }}
                placement="bottomRight"
            >
                <Button>
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                </Button>
            </Dropdown>
            <DeleteModal
                gdoc={gdoc}
                isOpen={isDeleteModalOpen}
                setIsOpen={setIsDeleteModalOpen}
                onOk={onDelete}
            />
        </>
    )
}

type DeleteFields = {
    shouldCreateTombstone: boolean
    reason?: string
    includeArchiveLink: boolean
    relatedLinkUrl?: string
    relatedLinkTitle?: string
    relatedLinkDescription?: string
    relatedLinkThumbnail?: string
}

function DeleteModal({
    gdoc,
    isOpen,
    setIsOpen,
    onOk,
}: {
    gdoc: OwidGdoc
    isOpen: boolean
    setIsOpen: (isOpen: boolean) => void
    onOk: (tombstone?: CreateTombstoneData) => Promise<void>
}) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    // We need to keep track of this state ourselves because antd form data
    // isn't reactive.
    const [shouldCreateTombstone, setShouldCreateTombstone] = useState(false)
    const [hasRelatedLink, setHasRelatedLink] = useState(false)

    async function handleOnFinish(fields: DeleteFields) {
        const tombstone = shouldCreateTombstone
            ? omit(fields, "shouldCreateTombstone")
            : undefined
        setIsSubmitting(true)
        await onOk(tombstone)
        setIsSubmitting(false)
        setIsOpen(false)
    }

    return (
        <Modal
            open={isOpen}
            title="Are you sure you want to delete this article?"
            okText="Delete"
            okType="danger"
            okButtonProps={{
                htmlType: "submit",
                // Note: antd makes it really hard/impossible to correctly
                // disable the button based on the form state, so we don't
                // use the disabled prop.
            }}
            confirmLoading={isSubmitting}
            cancelText="Cancel"
            onCancel={() => setIsOpen(false)}
            destroyOnClose
            // https://ant.design/components/form#why-is-there-a-form-warning-when-used-in-modal
            forceRender
            // Render the ok submit button inside the form.
            modalRender={(node) => (
                <Form<DeleteFields>
                    layout="vertical"
                    requiredMark="optional"
                    clearOnDestroy
                    onFinish={handleOnFinish}
                >
                    {node}
                </Form>
            )}
        >
            <>
                <p>
                    The article will be removed from the admin list and
                    unpublished. The original Google Doc will be preserved.
                </p>
                {gdoc.published && (
                    <Form.Item
                        name="shouldCreateTombstone"
                        extra={
                            <>
                                If checked, the article will be redirected to a
                                custom Not Found (404) page at{" "}
                                <code>/deleted/{gdoc.slug}</code>.
                            </>
                        }
                    >
                        <Checkbox
                            checked={shouldCreateTombstone}
                            onChange={(e) => {
                                setShouldCreateTombstone(e.target.checked)
                            }}
                        >
                            Create tombstone page
                        </Checkbox>
                    </Form.Item>
                )}
                {shouldCreateTombstone && (
                    <>
                        <Form.Item
                            name="reason"
                            label="Reason for removing the article"
                            extra="Will use a generic default message if left blank."
                        >
                            <Input.TextArea
                                placeholder={DEFAULT_TOMBSTONE_REASON}
                                rows={4}
                            />
                        </Form.Item>
                        <Form.Item
                            name="includeArchiveLink"
                            valuePropName="checked"
                            extra="Adds a paragraphs with automatically generated link to the Internet Archive's Wayback Machine."
                        >
                            <Checkbox>Include Wayback Machine link</Checkbox>
                        </Form.Item>
                        <fieldset>
                            <legend>Related prominent link</legend>
                            <Form.Item
                                name="relatedLinkUrl"
                                label="URL"
                                rules={[
                                    // NOTE: It's not easy to extract this to a
                                    // separate function because the exported
                                    // FormInstance type is incorrect in antd.
                                    (form) => {
                                        return form
                                            .getFieldValue("relatedLinkUrl")
                                            ?.startsWith(GDOCS_BASE_URL)
                                            ? {
                                                  pattern: gdocUrlRegex,
                                                  message: (
                                                      <>
                                                          Invalid Google Doc
                                                          URL. It should look
                                                          like this:
                                                          <br />
                                                          {
                                                              GDOCS_URL_PLACEHOLDER
                                                          }
                                                      </>
                                                  ),
                                              }
                                            : {
                                                  type: "url",
                                                  message: "Invalid URL.",
                                              }
                                    },
                                ]}
                                extra="Point user to a related page to help them find what they need."
                            >
                                <Input
                                    type="url"
                                    placeholder={GDOCS_URL_PLACEHOLDER}
                                    onChange={(e) =>
                                        setHasRelatedLink(
                                            Boolean(e.target.value)
                                        )
                                    }
                                />
                            </Form.Item>
                            {hasRelatedLink && (
                                <>
                                    <Form.Item
                                        name="relatedLinkTitle"
                                        label="Title"
                                        rules={[
                                            (form) => {
                                                const value =
                                                    form.getFieldValue(
                                                        "relatedLinkUrl"
                                                    )
                                                if (!value) {
                                                    return { type: "string" }
                                                }
                                                const url = Url.fromURL(value)
                                                if (url.isGoogleDoc) {
                                                    return { type: "string" }
                                                }
                                                return {
                                                    required: true,
                                                    message:
                                                        "Title is required.",
                                                }
                                            },
                                        ]}
                                        extra="Required for non-Google Doc URLs."
                                    >
                                        <Input type="text" />
                                    </Form.Item>
                                    <Form.Item
                                        name="relatedLinkDescription"
                                        label="Description"
                                    >
                                        <Input.TextArea />
                                    </Form.Item>
                                    <Form.Item
                                        name="relatedLinkThumbnail"
                                        label="Thumbnail file name"
                                        extra="The image must be already in Google Drive."
                                    >
                                        <Input type="text" />
                                    </Form.Item>
                                </>
                            )}
                        </fieldset>
                    </>
                )}
            </>
        </Modal>
    )
}
