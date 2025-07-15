import * as R from "remeda"
import React, { useContext, useState, useMemo, useEffect } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { Flex, Input, Breadcrumb, Space } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbPlainFile } from "@ourworldindata/types"

import { useQuery } from "@tanstack/react-query"

import { Admin } from "./Admin.js"
import urlJoin from "url-join"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCopy, faTimes } from "@fortawesome/free-solid-svg-icons"
import { copyToClipboard } from "@ourworldindata/utils"

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

function FileButton({
    file,
    showPath = false,
}: {
    file: DbPlainFile
    showPath?: boolean
}) {
    const fileUrl = getFileUrl(file)

    return (
        <div className="file-viewer__file">
            <div>
                <a href={fileUrl} target="_blank" rel="noopener">
                    {file.filename}
                </a>
                {showPath && (
                    <div
                        style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: 2,
                        }}
                    >
                        {file.path}
                    </div>
                )}
            </div>
            <button
                className="file-viewer__copy-button"
                onClick={() => copyToClipboard(fileUrl)}
            >
                <FontAwesomeIcon icon={faCopy} />
            </button>
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
        history.push(`?path=${currentPath}/${folderName}`)
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

    const filteredFiles = useMemo(() => {
        return allFiles.filter(
            (file) =>
                file.filename
                    .toLowerCase()
                    .includes(searchValue.toLowerCase()) ||
                file.path.toLowerCase().includes(searchValue.toLowerCase())
        )
    }, [allFiles, searchValue])

    // Show search view immediately when user starts typing
    if (!searchValue.trim()) {
        return (
            <div style={{ color: "#666", fontStyle: "italic" }}>
                Start typing to search files...
            </div>
        )
    }

    return (
        <div>
            <div style={{ marginBottom: 16, color: "#666" }}>
                Found {filteredFiles.length} file
                {filteredFiles.length !== 1 ? "s" : ""}
            </div>
            {filteredFiles.map((file) => {
                const fullPath = `${file.path}/${file.filename}`
                return <FileButton key={fullPath} file={file} showPath={true} />
            })}
        </div>
    )
}

export function FilesIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const location = useLocation()
    const history = useHistory()
    const [searchValue, setSearchValue] = useState("")

    // Get current path from URL query params
    const currentPath = new URLSearchParams(location.search).get("path") || ""

    const { data } = useQuery({
        queryKey: ["files"],
        queryFn: () => fetchFiles(admin),
    })

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
                        {/* <PostFileButton
                            postFile={postFileMutation}
                            currentPath={currentPath}
                        /> */}
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
