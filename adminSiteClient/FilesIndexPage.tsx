import * as R from "remeda"
import React, { useContext, useState, useMemo, useEffect } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { Flex, Input, Breadcrumb, Space, Tooltip } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbPlainFile } from "@ourworldindata/types"
import cx from "classnames"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Admin } from "./Admin.js"
import urlJoin from "url-join"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy, faSpinner, faTimes } from "@fortawesome/free-solid-svg-icons"
import { copyToClipboard } from "@ourworldindata/utils"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"

type FileMap = {
    [key: string]: DbPlainFile | FileMap
}

async function fetchFiles(admin: Admin): Promise<FileMap> {
    const { files } = await admin.getJSON<{ files: DbPlainFile[] }>(
        "/api/files.json"
    )
    return files.reduce((acc, file) => {
        const pathSegments = file.path.split("/")
        let current = acc

        for (const segment of pathSegments) {
            if (!current[segment]) {
                current[segment] = {}
            }
            current = current[segment] as FileMap
        }

        current[file.filename] = file

        return acc
    }, {} as FileMap)
}

function checkIsFile(node: FileMap[string]): node is DbPlainFile {
    return "filename" in node
}

const OWID_ASSETS_ENDPOINT = "https://assets.ourworldindata.org"

function getFileUrl(file: DbPlainFile): string {
    return urlJoin(OWID_ASSETS_ENDPOINT, file.path, file.filename)
}

const defaultHighlightFn = (text: string) => text

function FileButton({
    file,
    showPath = false,
    highlightFn = defaultHighlightFn,
}: {
    file: DbPlainFile
    showPath?: boolean
    highlightFn?: (text: string) => React.ReactNode
}) {
    const fileUrl = getFileUrl(file)

    return (
        <div className="file-viewer__file">
            <div>
                <a href={fileUrl} target="_blank" rel="noopener">
                    {highlightFn(file.filename)}
                </a>
                {showPath && (
                    <div
                        style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: 2,
                        }}
                    >
                        {highlightFn(file.path)}
                    </div>
                )}
            </div>
            <Tooltip title="Copy file URL">
                <button
                    className="file-viewer__copy-button"
                    onClick={() => copyToClipboard(fileUrl)}
                >
                    <FontAwesomeIcon icon={faCopy} />
                </button>
            </Tooltip>
        </div>
    )
}

function FolderButton({
    name,
    onClick,
}: {
    name: string
    onClick: () => void
}) {
    return (
        <button className="file-viewer__folder" onClick={onClick}>
            {name}
        </button>
    )
}

function FileMapViewer({
    fileMap,
    currentPath,
}: {
    fileMap: FileMap
    currentPath: string
}) {
    const history = useHistory()

    const handleFolderClick = (folderName: string) => {
        history.push(`?path=${urlJoin(currentPath, folderName)}`)
    }

    const pathSegments = currentPath.split("/").filter(Boolean)
    const currentNode = R.pathOr(fileMap, pathSegments as any, fileMap)

    return (
        <div>
            {Object.entries(currentNode).map(([key, value]) => {
                if (checkIsFile(value)) {
                    return <FileButton key={key} file={value} />
                } else {
                    return (
                        <FolderButton
                            key={key}
                            name={key}
                            onClick={() => handleFolderClick(key)}
                        />
                    )
                }
            })}
        </div>
    )
}

function SearchResultsViewer({
    fileMap,
    searchValue,
}: {
    fileMap: FileMap
    searchValue: string
}) {
    const allFiles = useMemo(() => {
        const flattenFiles = (
            map: FileMap,
            currentPath: string = ""
        ): DbPlainFile[] => {
            const files: DbPlainFile[] = []

            Object.entries(map).forEach(([key, value]) => {
                const fullPath = currentPath ? `${currentPath}/${key}` : key

                if (checkIsFile(value)) {
                    files.push(value)
                } else {
                    files.push(...flattenFiles(value, fullPath))
                }
            })

            return files
        }

        return flattenFiles(fileMap)
    }, [fileMap])
    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(searchValue),
        [searchValue]
    )

    const filteredFiles = useMemo(() => {
        const filterFn = filterFunctionForSearchWords(
            searchWords,
            (file: DbPlainFile) => [file.filename, file.path]
        )
        return allFiles.filter(filterFn)
    }, [allFiles, searchWords])

    const highlightFn = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )

    return (
        <div>
            <div style={{ marginBottom: 16, color: "#666" }}>
                Found {filteredFiles.length} file
                {filteredFiles.length !== 1 ? "s" : ""}
            </div>
            {filteredFiles.map((file) => {
                const fullPath = `${file.path}/${file.filename}`
                return (
                    <FileButton
                        key={fullPath}
                        file={file}
                        showPath={true}
                        highlightFn={highlightFn}
                    />
                )
            })}
        </div>
    )
}

function PostFileButton({ currentPath }: { currentPath: string }) {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const history = useHistory()

    const now = new Date()
    const defaultPath = urlJoin(
        "uploads",
        `${now.getFullYear()}`,
        `${now.getMonth() + 1}`.padStart(2, "0")
    )

    const uploadFileMutation = useMutation({
        mutationFn: async ({
            file,
            targetPath,
        }: {
            file: File
            targetPath: string
        }) => {
            const formData = new FormData()
            formData.append("file", file)

            const response = await admin.requestJSON<{
                success: boolean
                path: string
            }>(`/api/files?path=${targetPath}`, formData, "POST")

            if (!response.success) {
                throw new Error(`Upload failed`)
            }

            return response
        },
        onSuccess: async (response) => {
            await queryClient.invalidateQueries({ queryKey: ["files"] })
            history.push(`?path=${response.path}`)
        },
        onError: (error) => {
            console.error("File upload error:", error)
        },
    })

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0]
        if (!file) return

        const targetPath = currentPath || defaultPath
        uploadFileMutation.mutate({ file, targetPath })

        // Clear the input
        event.target.value = ""
    }

    return (
        <div>
            <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploadFileMutation.isLoading}
                style={{ display: "none" }}
                id="file-upload-input"
            />
            <label
                htmlFor="file-upload-input"
                className={cx(
                    "file-upload-label",
                    uploadFileMutation.isLoading && "is-uploading"
                )}
            >
                {uploadFileMutation.isLoading ? (
                    <FontAwesomeIcon icon={faSpinner} size="sm" spin />
                ) : (
                    <span>
                        <span>Upload File to </span>
                        {currentPath ? "the current folder" : defaultPath}
                    </span>
                )}
            </label>
        </div>
    )
}

export function FilesIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const location = useLocation()
    const history = useHistory()
    const [searchValue, setSearchValue] = useState("")

    const { data } = useQuery({
        queryKey: ["files"],
        queryFn: () => fetchFiles(admin),
    })

    // Get current path from URL query params
    const currentPath = new URLSearchParams(location.search).get("path") || ""

    // Validate path query param; remove it if the folder doesn't exist
    useEffect(() => {
        if (!data || !currentPath) return
        const pathSegments = currentPath.split("/").filter(Boolean)
        let activeNode = data
        for (const segment of pathSegments) {
            activeNode = activeNode[segment] as FileMap
            if (!activeNode) {
                history.push("/files")
                break
            }
        }
    }, [data, currentPath, history])

    const clearSearch = () => {
        setSearchValue("")
    }

    return (
        <AdminLayout title="Files">
            <main className="FilesIndexPage">
                <Space direction="vertical" style={{ width: "100%" }}>
                    <Flex justify="space-between" align="center">
                        <Input
                            placeholder="Search files and folders (min 4 characters)"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            style={{ width: 400 }}
                            suffix={
                                <FontAwesomeIcon
                                    icon={faTimes}
                                    onClick={clearSearch}
                                    style={{
                                        cursor: "pointer",
                                        color: "#999",
                                    }}
                                />
                            }
                        />
                        <PostFileButton currentPath={currentPath} />
                    </Flex>

                    <Breadcrumb
                        items={[
                            {
                                title: "Files",
                                href: "#",
                                onClick: (e) => {
                                    e.preventDefault()
                                    history.push("/files")
                                },
                            },
                            ...currentPath
                                .split("/")
                                .filter(Boolean)
                                .map((segment, index, arr) => {
                                    const path = arr
                                        .slice(0, index + 1)
                                        .join("/")
                                    return {
                                        title: segment,
                                        href: `?path=${path}`,
                                        onClick: (e: any) => {
                                            e.preventDefault()
                                            history.push(`?path=${path}`)
                                        },
                                    }
                                }),
                        ]}
                    />
                </Space>
                {searchValue.length > 3 ? (
                    <SearchResultsViewer
                        fileMap={data || {}}
                        searchValue={searchValue}
                    />
                ) : (
                    <FileMapViewer
                        fileMap={data || {}}
                        currentPath={currentPath}
                    />
                )}
            </main>
        </AdminLayout>
    )
}
