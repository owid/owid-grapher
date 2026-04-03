# Express to Hono Migration Plan

## Overview

Migrate the admin server from Express 5 to Hono. All Express usage is confined to `adminSiteServer/`. There are ~13 files that import from `express` directly, plus ~30 API route handler files that use `Request` and `HandlerResponse` types re-exported from `authentication.ts` and `FunctionalRouter.ts`.

## Key Differences: Express vs Hono

| Express | Hono |
|---------|------|
| `req.params.id` | `c.req.param("id")` |
| `req.query.foo` | `c.req.query("foo")` |
| `req.body` | `await c.req.json()` / `await c.req.parseBody()` |
| `req.cookies.X` | `getCookie(c, "X")` (built-in helper) |
| `req.headers["x-foo"]` / `req.get("x-foo")` | `c.req.header("x-foo")` |
| `req.ip` | `c.req.header("x-forwarded-for")` or custom |
| `res.locals.user` | `c.get("user")` / `c.set("user", ...)` (typed via `Variables`) |
| `res.send(html)` | `return c.html(html)` |
| `res.json(data)` | `return c.json(data)` |
| `res.status(404).send(msg)` | `return c.text(msg, 404)` |
| `res.set("Header", "val")` | `c.header("Header", "val")` |
| `res.redirect("/path")` | `return c.redirect("/path")` |
| `res.clearCookie("name")` | `deleteCookie(c, "name")` |
| `express.static("dir")` | `serveStatic({ root: "dir" })` from `@hono/node-server/serve-static` |
| `express.json()` | Built-in, `c.req.json()` parses on demand |
| `express.urlencoded()` | `c.req.parseBody()` handles this |
| `cookie-parser` | Built-in `hono/cookie` helper |
| `multer` (file upload) | `c.req.parseBody()` with `{ all: true }` or use `@hono/multer` |
| `Router()` | `new Hono()` (sub-apps) |
| Middleware `(req, res, next)` | `async (c, next) => { ... }` |
| Error handler `(err, req, res, next)` | `app.onError((err, c) => ...)` |
| `app.set("trust proxy", true)` | Not needed; read headers directly |

## Migration Strategy

The key insight is that **API route handlers** (the ~30 files in `apiRoutes/`) currently receive `(req: Request, res: HandlerResponse, trx)` and either return data (for FunctionalRouter routes) or call `res.send()`/`res.json()` (for plain router routes). We'll create a Hono-compatible wrapper layer that:

1. Extracts a request-like object from Hono's `Context` so handlers need minimal changes
2. Uses Hono's `Variables` typing for `c.get("user")` instead of `res.locals.user`

## Commits

### Commit 1: Install Hono, add type definitions and compatibility layer

**Files:**
- `package.json` — add `hono`, `@hono/node-server`, `@hono/multer`; remove `express`, `@types/express`, `cookie-parser`
- `adminSiteServer/authentication.ts` — redefine `Request` and `Response` types for Hono compatibility; rewrite the `AppVariables` type using Hono's `Variables` typing for `user`
- `adminSiteServer/FunctionalRouter.ts` — rewrite as a thin wrapper around `Hono` sub-app instead of Express `Router`. Keep the same external API (`get`, `post`, `put`, `patch`, `delete`, `postWithFileUpload`) but implement with Hono internals. The `wrap` method now uses Hono `Context` and returns JSON directly.
- `adminSiteServer/functionalRouterHelpers.ts` — update types from Express to Hono
- `adminSiteServer/plainRouterHelpers.ts` — update types from Express to Hono

### Commit 2: Rewrite authentication middleware for Hono

**Files:**
- `adminSiteServer/authentication.ts` — convert all middleware functions (`cloudflareAuthMiddleware`, `apiKeyAuthMiddleware`, `tailscaleAuthMiddleware`, `devAuthMiddleware`, `requireAdminAuthMiddleware`, `logOut`) from Express `(req, res, next)` to Hono `(c, next)` pattern. Use `c.set("user", user)` instead of `res.locals.user = user`. Use `getCookie`/`deleteCookie` from `hono/cookie` instead of `cookie-parser`.

### Commit 3: Rewrite appClass (main server) for Hono

**Files:**
- `adminSiteServer/appClass.tsx` — replace `express()` with `new Hono()`. Use `@hono/node-server`'s `serve()` for listening. Replace `express.static()` with `serveStatic()` from `@hono/node-server/serve-static`. Replace `Sentry.setupExpressErrorHandler()` with `app.onError()`. Wire up middleware and routes using `app.use()` and `app.route()`.

### Commit 4: Rewrite adminRouter and mockSiteRouter for Hono

**Files:**
- `adminSiteServer/adminRouter.tsx` — convert from Express `Router()` to `new Hono()`. Replace `express.json()` middleware with Hono's built-in body parsing. Update route handlers to use Hono `Context`.
- `adminSiteServer/mockSiteRouter.ts` — same conversion. Replace `express.static()` with `serveStatic()`. Update all route handlers.
- `adminSiteServer/plainRouterHelpers.ts` — update helper functions to work with Hono sub-apps instead of Express Router.

### Commit 5: Rewrite publicApiRouter and testPageRouter for Hono

**Files:**
- `adminSiteServer/publicApiRouter.ts` — convert health endpoint and narrative chart map route to Hono.
- `adminSiteServer/testPageRouter.tsx` — convert all test page routes to Hono.

### Commit 6: Update API route handlers to use Hono types

**Files (all in `adminSiteServer/apiRoutes/`):**
- Update imports in all ~30 handler files: change `import { Request } from "express"` or `import { Request } from "../authentication.js"` to use the new Hono-compatible types.
- Update `req.params.X` → `req.param("X")` or keep compatibility layer
- Update `req.query.X` → `req.query("X")` or keep compatibility layer  
- Update `req.body` → `await req.json()` or keep compatibility layer
- Update `res.locals.user` → `res.get("user")` or keep compatibility layer
- Update `req.get("header")` → `req.header("header")`
- Handle `req.file` (multer) for upload routes

The compatibility approach: Since there are ~30 handler files with hundreds of `res.locals.user`, `req.params`, `req.query`, and `req.body` usages, we will create a thin adapter in `FunctionalRouter.ts` and `plainRouterHelpers.ts` that extracts these from Hono's `Context` into an Express-like shape. This minimizes changes in handler files.

Specifically, the adapter will create:
- A `req`-like object with `.params`, `.query`, `.body`, `.get()`, `.cookies`, `.file`, `.ip`, `.path`, `.originalUrl`, `.method`, `.headers`, `.socket`
- A `res`-like object with `.locals` (mapped from `c.var`), `.set()`, `.status()`, etc.

This way, most handler files only need import path changes, not logic changes.

### Commit 7: Update test infrastructure

**Files:**
- `adminSiteServer/tests/testEnv.ts` — update `OwidAdminApp` usage for Hono. The test env creates the app and starts listening, which should work the same way since we use `@hono/node-server`.

### Commit 8: Clean up — remove Express dependencies and unused compatibility code

**Files:**
- `package.json` — verify `express`, `@types/express`, `cookie-parser` are removed
- Remove any remaining Express imports or type references
- Run typecheck and tests to verify everything works

## Risk Areas

1. **Vite middleware integration** — `app.use(vite.middlewares)` in dev mode. Vite's middleware is Connect-compatible. We'll need `@hono/vite-dev-server` or a compatibility adapter.
2. **Sentry integration** — `setupExpressErrorHandler` won't work. Use `app.onError()` and call `Sentry.captureException()` manually instead.
3. **File uploads (multer)** — Need `@hono/multer` or manual multipart parsing via `c.req.parseBody()`.
4. **Static file serving** — `@hono/node-server/serve-static` works differently from Express static. Need to test path resolution.
5. **Streaming responses** — `adminRouter` has one route that uses `res.write()` for streaming CSV. Hono supports `c.stream()` for this.
6. **`res.attachment()`** — Used in CSV download. Need manual `Content-Disposition` header.
7. **`res.contentType()`** — Used in one place. Replace with `c.header("Content-Type", ...)`.

## Dependencies to Add/Remove

**Add:**
- `hono`
- `@hono/node-server`  
- `@hono/multer` (for file upload compatibility)

**Remove:**
- `express`
- `@types/express`
- `cookie-parser`
