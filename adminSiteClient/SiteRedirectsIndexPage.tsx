import cx from "classnames"
import React, { useContext, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"

const SOURCE_PATTERN = /^\/$|^\/.*[^\/]+$/
const INVALID_SOURCE_MESSAGE =
    "URL must start with a slash and cannot end with a slash, unless it's the root."
const TARGET_PATTERN = /^\/$|^(https?:\/\/|\/).*[^\/]+$/
const INVALID_TARGET_MESSAGE =
    "URL must start with a slash or http(s):// and cannot end with a slash, unless it's the root."

type Redirect = {
    id: number
    source: string
    target: string
}

function RedirectRow({
    redirect,
    onDelete,
}: {
    redirect: Redirect
    onDelete: (redirect: Redirect) => void
}) {
    return (
        <tr>
            <td className="text-break">{redirect.source}</td>
            <td className="text-break">
                <a href={redirect.target} target="_blank" rel="noopener">
                    {redirect.target}
                </a>
            </td>
            <td>
                <button
                    className="btn btn-danger"
                    onClick={() => onDelete(redirect)}
                >
                    Delete
                </button>
            </td>
        </tr>
    )
}

type FormData = {
    source: string
    target: string
}

export default function SiteRedirectsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [redirects, setRedirects] = useState<Redirect[]>([])
    const [error, setError] = useState<string | null>(null)
    const {
        register,
        formState: { errors, isSubmitting },
        handleSubmit,
        setValue,
        watch,
    } = useForm<FormData>()
    const source = watch("source")

    useEffect(() => {
        admin
            .getJSON("/api/site-redirects.json")
            .then((json) => {
                setRedirects(json.redirects)
            })
            .catch(() => {
                setError("Error loading redirects.")
            })
    }, [admin])

    function validateTarget(value: string) {
        if (value === source) {
            return "Source and target cannot be the same."
        }
        return undefined
    }

    async function onSubmit({ source, target }: FormData) {
        const sourceUrl = new URL(source, window.location.origin)
        const sourcePath = sourceUrl.pathname
        setValue("source", sourcePath)
        setError(null)
        const json = await admin.requestJSON(
            "/api/site-redirects/new",
            { source: sourcePath, target },
            "POST"
        )
        if (json.success) {
            setRedirects([json.redirect, ...redirects])
        } else {
            setError("Error creating a redirect.")
        }
    }

    async function handleDelete(redirect: Redirect) {
        if (!window.confirm(`Delete the redirect from ${redirect.source}?`)) {
            return
        }
        setError(null)
        const json = await admin.requestJSON(
            `/api/site-redirects/${redirect.id}`,
            {},
            "DELETE"
        )
        if (json.success) {
            setRedirects(redirects.filter((r) => r.id !== redirect.id))
        } else {
            setError("Error deleting the redirect.")
        }
    }

    return (
        <AdminLayout title="Site Redirects">
            <main>
                <div className="row">
                    <div className="col-12 col-md-8">
                        <p>
                            This page is used to create and delete redirects for
                            the site. Don't use this page to create redirects
                            for charts, use the{" "}
                            <Link to="/redirects">chart redirects page</Link>{" "}
                            instead.
                        </p>
                        <p>
                            The source has to start with a slash and any query
                            parameters (/war-and-peace
                            <span className="redirect-emphasis">
                                ?insight=insightid
                            </span>
                            ) or fragments (/war-and-peace
                            <span className="redirect-emphasis">
                                #all-charts
                            </span>
                            ) will be stripped, if present.
                        </p>
                        <p>
                            The target can point to a full URL at another domain
                            or a relative URL starting with a slash and both
                            query parameters and fragments are allowed.
                        </p>
                        <p>
                            To redirect to our homepage use a single slash as
                            the target.
                        </p>
                    </div>
                </div>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="form-row">
                        <div className="form-group col-12 col-md-4">
                            <label>Source</label>
                            <input
                                className={cx("form-control", {
                                    "is-invalid": errors.source,
                                })}
                                placeholder="/fertility-can-decline-extremely-fast"
                                {...register("source", {
                                    required: "Please provide a source.",
                                    pattern: {
                                        value: SOURCE_PATTERN,
                                        message: INVALID_SOURCE_MESSAGE,
                                    },
                                })}
                            />
                            <div className="invalid-feedback">
                                {errors.source?.message}
                            </div>
                        </div>
                        <div className="form-group col-12 col-md-4">
                            <label>Target</label>
                            <input
                                className={cx("form-control", {
                                    "is-invalid": errors.target,
                                })}
                                placeholder="/fertility-rate"
                                {...register("target", {
                                    required: "Please provide a target.",
                                    pattern: {
                                        value: TARGET_PATTERN,
                                        message: INVALID_TARGET_MESSAGE,
                                    },
                                    validate: validateTarget,
                                })}
                            />
                            <div className="invalid-feedback">
                                {errors.target?.message}
                            </div>
                        </div>
                    </div>
                    <button
                        className="btn btn-primary mb-3"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        Create
                    </button>
                    {error && <div className="text-danger mb-3">{error}</div>}
                </form>
                <p>Showing {redirects.length} redirects</p>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>Source</th>
                            <th>Target</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {redirects.map((redirect) => (
                            <RedirectRow
                                key={redirect.id}
                                redirect={redirect}
                                onDelete={handleDelete}
                            />
                        ))}
                    </tbody>
                </table>
            </main>
        </AdminLayout>
    )
}
