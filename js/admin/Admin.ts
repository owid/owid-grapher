/* Admin.ts
 * ================
 *
 * Singleton which governs interaction with the grapher admin server.
 */

declare var Global: { rootUrl: string }

class Admin {
    url(path: string): string {
        return Global.rootUrl + path;
    }

    get csrfToken() {
        const meta = document.querySelector("[name=_token]")
        if (!meta)
            throw new Error("Could not find csrf token")
        return meta.getAttribute("value")
    }

    fetchJSON(path: string) {
        return fetch(this.url(path), { credentials: 'same-origin' }).then(data => data.json());
    }

    get(path: string) {
        return this.request(path, {}, 'GET')
    }

    request(path: string, data: Object, method: 'GET'|'PUT'|'POST') {
        return fetch(this.url(path), {
            method: method,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRFToken': this.csrfToken
            },
            body: method != 'GET' ? JSON.stringify(data) : undefined
        })
    }
}

const admin = new Admin()
declare var window: any
window.Admin = admin
export default admin