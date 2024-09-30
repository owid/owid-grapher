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
    gdocUrlRegex,
    OwidGdoc,
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
    onDelete: (tombstone?: CreateTombstoneData) => void
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
    relatedLink?: string
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
    onOk: (tombstone?: CreateTombstoneData) => void
}) {
    // We need to keep track of this state ourselves because antd form data
    // isn't reactive.
    const [shouldCreateTombstone, setShouldCreateTombstone] = useState(false)

    function handleOnFinish({ reason, relatedLink }: DeleteFields) {
        const tombstone = shouldCreateTombstone
            ? { reason, relatedLink }
            : undefined
        onOk(tombstone)
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
                            name="relatedLink"
                            label="Related link"
                            rules={[
                                {
                                    pattern: gdocUrlRegex,
                                    message: (
                                        <>
                                            Invalid Google Doc URL. It should
                                            look like this:
                                            <br />
                                            {GDOCS_URL_PLACEHOLDER}
                                        </>
                                    ),
                                },
                            ]}
                            extra="Point user to a related page to help them find what they need."
                        >
                            <Input
                                type="url"
                                placeholder={GDOCS_URL_PLACEHOLDER}
                            />
                        </Form.Item>
                    </>
                )}
            </>
        </Modal>
    )
}
