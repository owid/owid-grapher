import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import {
    Button,
    Flex,
    Input,
    Mentions,
    Popconfirm,
    Space,
    Table,
    Upload,
} from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbEnrichedImageWithUserId, DbPlainUser } from "@ourworldindata/types"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faClose, faUpload } from "@fortawesome/free-solid-svg-icons"
import { Admin } from "./Admin.js"
import { RcFile } from "antd/es/upload/interface.js"
import TextArea from "antd/es/input/TextArea.js"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"
import { keyBy } from "lodash"

// Define map types
type ImageMap = Record<string, DbEnrichedImageWithUserId>

type UserMap = Record<string, DbPlainUser>

type ImageEditorApi = {
    patchImage: (
        image: DbEnrichedImageWithUserId,
        patch: Partial<DbEnrichedImageWithUserId>
    ) => void
    deleteImage: (image: DbEnrichedImageWithUserId) => void
    getImages: () => void
    getUsers: () => void
    postUserXImage: (
        user: DbPlainUser,
        image: DbEnrichedImageWithUserId
    ) => void
    deleteUserXImage: (
        user: DbPlainUser,
        image: DbEnrichedImageWithUserId
    ) => void
}

function mapToArray<T>(map: { [id: string]: T }): T[] {
    return Object.values(map)
}

function AltTextEditor({
    image,
    text,
    patchImage,
}: {
    image: DbEnrichedImageWithUserId
    text: string
    patchImage: ImageEditorApi["patchImage"]
}) {
    const [value, setValue] = useState(text)

    const handleBlur = useCallback(
        (e: React.FocusEvent<HTMLTextAreaElement>) => {
            const trimmed = e.target.value.trim()
            setValue(trimmed)
            if (trimmed !== text) {
                patchImage(image, { defaultAlt: trimmed })
            }
        },
        [image, text, patchImage]
    )

    return (
        <TextArea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
        />
    )
}

function UserSelect({
    usersMap,
    initialValue = "",
    onUserSelect,
}: {
    usersMap: UserMap
    initialValue?: string
    onUserSelect: (user: DbPlainUser) => void
}) {
    const [isSetting, setIsSetting] = useState(false)

    const { admin } = useContext(AdminAppContext)
    const [value, setValue] = useState(initialValue)
    const [filteredOptions, setFilteredOptions] = useState(() =>
        mapToArray(usersMap).map((user) => ({
            value: user.fullName,
            label: user.fullName,
        }))
    )

    const handleChange = (value: string) => {
        setValue(value)
        const lowercaseValue = value.toLowerCase()
        setFilteredOptions(
            mapToArray(usersMap)
                .filter((user) =>
                    user.fullName.toLowerCase().includes(lowercaseValue)
                )
                .map((user) => ({
                    value: user.fullName,
                    label: user.fullName,
                }))
        )
    }

    const handleSelect = async (option: { value?: string; label?: string }) => {
        const selectedUser = mapToArray(usersMap).find(
            (u) => u.fullName === option.value
        )
        if (selectedUser) {
            setValue(selectedUser.fullName)
            await onUserSelect(selectedUser)
        }
    }

    if (isSetting) {
        return (
            <Mentions
                prefix=""
                allowClear
                value={value}
                onChange={handleChange}
                onSelect={handleSelect}
                options={filteredOptions}
            />
        )
    }
    return (
        <div>
            <Button
                type="text"
                onClick={() => handleSelect({ value: admin.username })}
            >
                Claim
            </Button>
            <Button type="text" onClick={() => setIsSetting(true)}>
                Set
            </Button>
        </div>
    )
}

function createColumns({
    api,
    users,
}: {
    api: ImageEditorApi
    users: UserMap
}): ColumnsType<DbEnrichedImageWithUserId> {
    return [
        {
            title: "Preview",
            dataIndex: "cloudflareId",
            width: 100,
            key: "cloudflareId",
            render: (cloudflareId, { originalWidth }) => {
                const srcFor = (w: number) =>
                    `${CLOUDFLARE_IMAGES_URL}/${encodeURIComponent(
                        cloudflareId
                    )}/w=${w}`
                return (
                    <div style={{ height: 100, width: 100 }} key={cloudflareId}>
                        <a
                            target="_blank"
                            href={`${srcFor(originalWidth!)}`}
                            rel="noopener"
                        >
                            <img
                                src={`${srcFor(200)}`}
                                style={{ maxHeight: 100, maxWidth: 100 }}
                            />
                        </a>
                    </div>
                )
            },
        },
        {
            title: "Filename",
            dataIndex: "filename",
            key: "filename",
            width: 300,
        },
        {
            title: "Alt text",
            dataIndex: "defaultAlt",
            key: "defaultAlt",
            sorter: (a, b) =>
                a.defaultAlt && b.defaultAlt
                    ? a.defaultAlt.localeCompare(b.defaultAlt)
                    : 0,
            render: (text, image) => (
                <AltTextEditor
                    key={image.cloudflareId}
                    text={text}
                    image={image}
                    patchImage={api.patchImage}
                />
            ),
        },
        {
            title: "Width",
            dataIndex: "originalWidth",
            key: "originalWidth",
            sorter: (a, b) =>
                a.originalWidth && b.originalWidth
                    ? a.originalWidth - b.originalWidth
                    : 0,
            width: 100,
        },
        {
            title: "Height",
            dataIndex: "originalHeight",
            key: "originalHeight",
            sorter: (a, b) =>
                a.originalHeight && b.originalHeight
                    ? a.originalHeight - b.originalHeight
                    : 0,
            width: 100,
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 150,
            defaultSortOrder: "descend",
            sorter: (a, b) =>
                a.updatedAt && b.updatedAt ? a.updatedAt - b.updatedAt : 0,
            render: (time) => <Timeago time={time} />,
        },
        {
            title: "Owner",
            key: "userId",
            width: 200,
            render: (_, image) => {
                const user = users[image.userId]
                if (!user)
                    return (
                        <UserSelect
                            usersMap={users}
                            onUserSelect={(user) =>
                                api.postUserXImage(user, image)
                            }
                        />
                    )
                return (
                    <div>
                        {user.fullName}
                        <button
                            className="ImageIndexPage__delete-user-button"
                            onClick={() => api.deleteUserXImage(user, image)}
                        >
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </div>
                )
            },
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            render: (_, image) => (
                <Space size="middle">
                    <Popconfirm
                        title="Are you sure?"
                        description="This will delete the image being used in production."
                        onConfirm={() => api.deleteImage(image)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="text" danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]
}

function ImageUploadButton({
    setImagesMap,
    admin,
}: {
    setImagesMap: React.Dispatch<React.SetStateAction<ImageMap>>
    admin: Admin
}) {
    function uploadImage({ file }: { file: string | Blob | RcFile }) {
        if (typeof file === "string") return

        const reader = new FileReader()
        reader.onload = async () => {
            const base64Data = reader.result?.toString()

            const payload = {
                filename: file.name,
                content: base64Data,
                type: file.type,
            }

            const { image } = await admin.requestJSON<{
                sucess: true
                image: DbEnrichedImageWithUserId
            }>("/api/image", payload, "POST")

            setImagesMap((imagesMap) => ({
                ...imagesMap,
                [image.id]: image,
            }))
        }
        reader.readAsDataURL(file)
    }
    return (
        <Upload showUploadList={false} customRequest={uploadImage}>
            <Button type="primary" icon={<FontAwesomeIcon icon={faUpload} />}>
                Upload image
            </Button>
        </Upload>
    )
}

export function ImageIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [images, setImages] = useState<ImageMap>({})
    const [users, setUsers] = useState<UserMap>({})
    const [filenameSearchValue, setFilenameSearchValue] = useState("")

    const api = useMemo(
        (): ImageEditorApi => ({
            deleteImage: async (image) => {
                await admin.requestJSON(`/api/images/${image.id}`, {}, "DELETE")
                setImages((prevMap) => {
                    const newMap = { ...prevMap }
                    delete newMap[image.id]
                    return newMap
                })
            },
            getImages: async () => {
                const json = await admin.getJSON<{
                    images: DbEnrichedImageWithUserId[]
                }>("/api/images.json")
                setImages(keyBy(json.images, "id"))
            },
            getUsers: async () => {
                const json = await admin.getJSON<{ users: DbPlainUser[] }>(
                    "/api/users.json"
                )
                setUsers(keyBy(json.users, "id"))
            },
            patchImage: async (image, patch) => {
                const response = await admin.requestJSON<{
                    success: true
                    image: DbEnrichedImageWithUserId
                }>(`/api/images/${image.id}`, patch, "PATCH")
                setImages((prevMap) => ({
                    ...prevMap,
                    [image.id]: response.image,
                }))
            },
            postUserXImage: async (user, image) => {
                const result = await admin.requestJSON(
                    `/api/users/${user.id}/image/${image.id}`,
                    {},
                    "POST"
                )
                if (result.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: { ...prevMap[image.id], userId: user.id },
                    }))
                }
            },
            deleteUserXImage: async (user, image) => {
                const result = await admin.requestJSON(
                    `/api/users/${user.id}/image/${image.id}`,
                    {},
                    "DELETE"
                )
                if (result.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: { ...prevMap[image.id], userId: null },
                    }))
                }
            },
        }),
        [admin]
    )

    const filteredImages = useMemo(
        () =>
            mapToArray(images).filter((image) =>
                image.filename
                    .toLowerCase()
                    .includes(filenameSearchValue.toLowerCase())
            ),
        [images, filenameSearchValue]
    )

    const columns = useMemo(() => createColumns({ api, users }), [api, users])

    useEffect(() => {
        void api.getImages()
        void api.getUsers()
    }, [api])

    return (
        <AdminLayout title="Images">
            <main className="ImageIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search by filename or owner"
                        value={filenameSearchValue}
                        onChange={(e) => setFilenameSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                    <ImageUploadButton setImagesMap={setImages} admin={admin} />
                </Flex>
                <Table columns={columns} dataSource={filteredImages} />
            </main>
        </AdminLayout>
    )
}
