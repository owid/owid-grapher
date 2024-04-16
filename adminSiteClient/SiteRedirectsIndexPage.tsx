import cx from "classnames"
import React, { useContext, useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"

const VALID_PATTERN = /^\/$|^.*[^\/]+$/
const INVALID_PATTERN_MESSAGE =
    "URL cannot end with a slash unless it's the root."

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

    async function onSubmit(data: FormData) {
        setError(null)
        const json = await admin.requestJSON(
            "/api/site-redirects/new",
            data,
            "POST"
        )
        if (json.success) {
            setRedirects([json.redirect, ...redirects])
        } else {
            setError("Error creating a redirect.")
        }
    }

    async function handleDelete(redirect: Redirect) {
        if (!window.confirm(`Delete the redirect from ${redirect.source}?`))
            return
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
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="form-row">
                        <div className="form-group col-12 col-md-4">
                            <label>Source</label>
                            <input
                                className={cx("form-control", {
                                    "is-invalid": errors.source,
                                })}
                                {...register("source", {
                                    required: "Please provide a source.",
                                    pattern: {
                                        value: VALID_PATTERN,
                                        message: INVALID_PATTERN_MESSAGE,
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
                                {...register("target", {
                                    required: "Please provide a target.",
                                    pattern: {
                                        value: VALID_PATTERN,
                                        message: INVALID_PATTERN_MESSAGE,
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
