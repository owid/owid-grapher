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
