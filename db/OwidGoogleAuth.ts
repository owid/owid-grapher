import {
    GDOCS_CLIENT_EMAIL,
    GDOCS_PRIVATE_KEY,
} from "../settings/serverSettings.js"
import { type docs_v1 } from "@googleapis/docs"
import { JWT } from "google-auth-library"

export class OwidGoogleAuth {
    static cachedGoogleReadonlyAuth?: JWT
    static cachedGoogleReadWriteAuth?: JWT
    static cachedGoogleClient?: docs_v1.Docs

    static areGdocAuthKeysSet(): boolean {
        return !!(GDOCS_PRIVATE_KEY && GDOCS_CLIENT_EMAIL)
    }

    private static makeServiceAccountAuth(scopes: string[]): JWT {
        return new JWT({
            email: GDOCS_CLIENT_EMAIL,
            key: GDOCS_PRIVATE_KEY.split("\\n").join("\n"),
            scopes,
        })
    }

    static getGoogleReadWriteAuth(): JWT {
        if (!OwidGoogleAuth.cachedGoogleReadWriteAuth) {
            OwidGoogleAuth.cachedGoogleReadWriteAuth =
                OwidGoogleAuth.makeServiceAccountAuth([
                    "https://www.googleapis.com/auth/documents",
                    "https://www.googleapis.com/auth/drive",
                ])
        }
        return OwidGoogleAuth.cachedGoogleReadWriteAuth
    }

    static getGoogleReadonlyAuth(): JWT {
        if (!OwidGoogleAuth.cachedGoogleReadonlyAuth) {
            OwidGoogleAuth.cachedGoogleReadonlyAuth =
                OwidGoogleAuth.makeServiceAccountAuth([
                    "https://www.googleapis.com/auth/documents.readonly",
                    "https://www.googleapis.com/auth/drive.readonly",
                ])
        }
        return OwidGoogleAuth.cachedGoogleReadonlyAuth
    }
}

/**
 * Google only shows a doc's suggestions to accounts that can comment on it or
 * edit it, whatever the OAuth scope, and answers anyone else with a 403. The
 * service account is a viewer on most docs, so turn that 403 into a message
 * that says which access is missing.
 */
export function explainSuggestionsAccessError(
    error: unknown,
    clientEmail: string = GDOCS_CLIENT_EMAIL
): unknown {
    const status = (error as { status?: unknown } | null)?.status
    if (status !== 403) return error
    const googleMessage = error instanceof Error ? error.message : String(error)
    return new Error(
        `Can't preview suggestions: Google only shares a doc's suggestions with accounts that can comment on it, and the service account ${clientEmail} can only view this doc. Give it Commenter access to the doc (or to its shared drive). Google's message: ${googleMessage}`,
        { cause: error }
    )
}
