# Baker

This folder contains code for baking and deploying the live site.

## Deploys

Admin edits don't bake anything themselves. A route that changes something the site shows calls `enqueueDeployChange(user, message)` (`DeployUtils.ts`), which requests a build of the content deploy pipeline (`BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG`, for `BUILDKITE_BRANCH`) that nobody waits for. Routes call it before their transaction commits; the bake reads the database seconds later, and an edit that rolls back only costs a redundant bake. The first edit after a quiet spell is requested right away; edits in the window that follows (`DEPLOY_REQUEST_WINDOW_MS`, in the types package) are held and go out together when it ends, so an ETL push of hundreds of admin API calls makes a handful of requests. Held edits are also sent when the process shuts down. Every build is a full bake. The window is longer than a build takes, so requests don't queue up behind the deploy lock. A failed request goes to Sentry, always as the same issue (fingerprint `deploy-request-failed`), and the edit goes out with the next deploy.

Nothing is requested unless `BAKE_ON_CHANGE` is set, which it isn't in local dev: the dev server renders pages on demand, and `make local-bake` bakes the whole site.

The admin's `/deploys` page lists the pipeline's recent builds and has a button to request one.
