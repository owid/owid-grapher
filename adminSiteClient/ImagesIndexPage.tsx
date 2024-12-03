import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { Button, Flex, Input, Mentions, Popconfirm, Table, Upload } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbEnrichedImageWithUserId, DbPlainUser } from "@ourworldindata/types"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faClose, faUpload } from "@fortawesome/free-solid-svg-icons"
import { RcFile } from "antd/es/upload/interface.js"
import TextArea from "antd/es/input/TextArea.js"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"
import { keyBy } from "lodash"

type ImageMap = Record<string, DbEnrichedImageWithUserId>

type UserMap = Record<string, DbPlainUser>

type ImageEditorApi = {
    patchImage: (
        image: DbEnrichedImageWithUserId,
        patch: Partial<DbEnrichedImageWithUserId>
    ) => void
    putImage: (
        id: number,
        payload: {
            filename: string
            content?: string
            type: string
        }
    ) => void
    postImage: (payload: {
        filename: string
        content?: string
        type: string
    }) => void
    deleteImage: (image: DbEnrichedImageWithUserId) => void
    getImages: () => void
    getUsers: () => void
    postUserImage: (user: DbPlainUser, image: DbEnrichedImageWithUserId) => void
    deleteUserImage: (
        user: DbPlainUser,
        image: DbEnrichedImageWithUserId
    ) => void
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
        Object.values(usersMap).map((user) => ({
            value: user.fullName,
            label: user.fullName,
        }))
    )

    const handleChange = (value: string) => {
        setValue(value)
        const lowercaseValue = value.toLowerCase()
        setFilteredOptions(
            Object.values(usersMap)
                .filter((user) =>
                    user.fullName.toLowerCase().includes(lowercaseValue)
                )
                .map((user) => ({
                    value: String(user.id),
                    label: user.fullName,
                }))
        )
    }

    const handleSelect = async (option: { value?: string; label?: string }) => {
        // iterating because we only have the label when using the admin context
        const selectedUser = Object.values(usersMap).find(
            (user) => user.fullName === option.label
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
                autoFocus
                allowClear
                value={value}
                onKeyDown={(e) => {
                    if (e.key === "Escape") setIsSetting(false)
                }}
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
                onClick={() => handleSelect({ label: admin.username })}
            >
                + {admin.username}
            </Button>
            <Button type="text" onClick={() => setIsSetting(true)}>
                + Someone else
            </Button>
        </div>
    )
}

// when updatedAt changes, the image will reload the src
// but it looks like sometimes cloudflare doesn't update in time :(
function ImgWithRefresh({
    src,
    updatedAt,
}: {
    src: string
    updatedAt: number | null
}) {
    const ref = useRef<HTMLImageElement>(null)
    useEffect(() => {
        if (ref.current && updatedAt) {
            ref.current.src = ""
            fetch(src, { cache: "reload" })
                .then(() => {
                    if (ref.current) {
                        ref.current.src = src
                    }
                })
                .catch(() => {
                    console.log("Something went wrong refreshing the image")
                })
        }
    })
    return <img ref={ref} src={src} style={{ maxHeight: 100, maxWidth: 100 }} />
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
            render: (cloudflareId, { originalWidth, updatedAt }) => {
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
                            <ImgWithRefresh
                                src={`${srcFor(200)}`}
                                updatedAt={updatedAt}
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
            filters: [
                {
                    text: "Unassigned",
                    value: null as any,
                },
                ...Object.values(users)
                    .map((user) => ({
                        text: user.fullName,
                        value: user.id,
                    }))
                    .sort((a, b) => a.text.localeCompare(b.text)),
            ],
            onFilter: (value, record) => record.userId === value,
            render: (_, image) => {
                const user = users[image.userId]
                if (!user)
                    return (
                        <UserSelect
                            usersMap={users}
                            onUserSelect={(user) =>
                                api.postUserImage(user, image)
                            }
                        />
                    )
                return (
                    <div>
                        {user.fullName}
                        <button
                            className="ImageIndexPage__delete-user-button"
                            onClick={() => api.deleteUserImage(user, image)}
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
                <Flex vertical>
                    <PutImageButton putImage={api.putImage} id={image.id} />
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
                </Flex>
            ),
        },
    ]
}

type File = string | Blob | RcFile

type FileToBase64Result = {
    filename: string
    content: string
    type: string
}

/**
 * Uploading as base64, because otherwise we'd need multipart/form-data parsing middleware in the server.
 * This seems easier as a one-off.
 **/
function fileToBase64(file: File): Promise<FileToBase64Result | null> {
    if (typeof file === "string") return Promise.resolve(null)

    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve({
                filename: file.name,
                content: reader.result?.toString() ?? "",
                type: file.type,
            })
        }
        reader.readAsDataURL(file)
    })
}

function PostImageButton({
    postImage,
}: {
    postImage: ImageEditorApi["postImage"]
}) {
    async function uploadImage({ file }: { file: File }) {
        const result = await fileToBase64(file)
        if (result) {
            postImage(result)
        }
    }
    return (
        <Upload showUploadList={false} customRequest={uploadImage}>
            <Button type="primary">
                <FontAwesomeIcon icon={faUpload} /> Upload
            </Button>
        </Upload>
    )
}

function PutImageButton({
    putImage,
    id,
}: {
    putImage: ImageEditorApi["putImage"]
    id: number
}) {
    async function uploadImage({ file }: { file: File }) {
        const result = await fileToBase64(file)
        if (result) {
            putImage(id, result)
        }
    }
    return (
        <Upload showUploadList={false} customRequest={uploadImage}>
            <Button className="ImageIndexPage__update-image-button" type="text">
                Upload new version
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
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: response.image,
                    }))
                }
            },
            postImage: async (image) => {
                const response = await admin.requestJSON<{
                    success: true
                    image: DbEnrichedImageWithUserId
                }>(`/api/images`, image, "POST")
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [response.image.id]: response.image,
                    }))
                }
            },
            putImage: async (id, payload) => {
                const response = await admin.requestJSON<{
                    success: true
                    image: DbEnrichedImageWithUserId
                }>(`/api/images/${id}`, payload, "PUT")
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [id]: response.image,
                    }))
                }
            },
            postUserImage: async (user, image) => {
                const response = await admin.requestJSON(
                    `/api/users/${user.id}/images/${image.id}`,
                    {},
                    "POST"
                )
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: { ...prevMap[image.id], userId: user.id },
                    }))
                }
            },
            deleteUserImage: async (user, image) => {
                const result = await admin.requestJSON(
                    `/api/users/${user.id}/images/${image.id}`,
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
            Object.values(images).filter((image) =>
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
                        placeholder="Search by filename"
                        value={filenameSearchValue}
                        onChange={(e) => setFilenameSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                    <PostImageButton postImage={api.postImage} />
                </Flex>
                <Table columns={columns} dataSource={filteredImages} />
            </main>
        </AdminLayout>
    )
}
