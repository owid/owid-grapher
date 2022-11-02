import React from "react"
import { Dropdown, Menu, Button, Modal } from "antd"
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons/faEllipsisVertical"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidArticleType } from "@ourworldindata/utils"

enum GdocsMoreMenuAction {
    Delete = "delete",
    Unpublish = "unpublish",
}

export const GdocsMoreMenu = ({
    gdoc,
    onUnpublish,
    onDelete,
}: {
    gdoc: OwidArticleType
    onUnpublish: VoidFunction
    onDelete: VoidFunction
}) => {
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
        })
    }
    const confirmDelete = () => {
        Modal.confirm({
            title: "Are you sure you want to delete this article?",
            content:
                "The article will be removed from the admin list and unpublished. The original Google Doc will be preserved.",
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            onOk() {
                onDelete()
            },
        })
    }
    return (
        <Dropdown
            trigger={["click"]}
            overlay={
                <Menu
                    onClick={({ key }) => {
                        switch (key) {
                            case GdocsMoreMenuAction.Unpublish:
                                confirmUnpublish()
                                break
                            case GdocsMoreMenuAction.Delete:
                                confirmDelete()
                                break
                        }
                    }}
                    items={[
                        {
                            key: GdocsMoreMenuAction.Unpublish,
                            label: "Unpublish",
                            danger: gdoc.published,
                            disabled: !gdoc.published,
                        },
                        {
                            key: GdocsMoreMenuAction.Delete,
                            label: "Delete",
                            danger: true,
                        },
                    ]}
                />
            }
            placement="bottomRight"
        >
            <Button>
                <FontAwesomeIcon icon={faEllipsisVertical} />
            </Button>
        </Dropdown>
    )
}
