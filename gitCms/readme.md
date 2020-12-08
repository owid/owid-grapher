# GitCMS

This subproject contains simple express routes and methods for writing files to a git backed folder and a browser client for interacting with those methods.

## Rationale

While SQL DBs are great for our high volume, stable object types, they might be overkill for some small authored item types, where the schemas change at a much faster clip. More importantly, we get to leverage a huge variety of tools and features around collaboration, versioning, auditing, and editing by using Git as our backend.

## Goals

-   Make it easier for authors to edit more things that lie between "content" and "code"
-   Allow new ways for authors to edit content in a safe way
-   Save dev time by just using Git for versioning author editable content
-   Increase dev speed by making it faster and less painful to do migrations
-   Increase dev speed by enabling faster syncing to dev of certain authored content from prod
-   Hopefully lead to some unplanned benefits by making some content more accessible

## Implementation notes

`GitCmsServer.ts` adds some routes to our API for writing, reading, and deleting files in the "GitCMS". The writes and deletes are committed and pushed.

`GitCmsClient.ts` contains methods for the browser to call these API routes.

## todo:

-   Cleanup the routes and the unneeded admin vs api split
-   Better test coverage and integration tests
-   Support saving drafts to private repos
-   Better branch handling
-   Better syncing with remote repos
