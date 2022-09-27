import React from "react"
import { Dropdown, Menu, Button } from "antd"
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons/faEllipsisVertical"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"

export const GdocsMoreMenu = ({
    gdoc,
    onUnpublish,
}: {
    gdoc: OwidArticleType
    onUnpublish: VoidFunction
}) => (
    <Dropdown
        overlay={
            <Menu
                onClick={({ key }) => {
                    switch (key) {
                        case "unpublish":
                            onUnpublish()
                            break

                        default:
                            break
                    }
                }}
                items={[
                    {
                        key: "unpublish",
                        label: "Unpublish",
                        danger: gdoc.published,
                        disabled: !gdoc.published,
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
