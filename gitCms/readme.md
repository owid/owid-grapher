# GitCMS

This subproject contains simple express routes and methods for writing files to a git backed folder and a browser client for interacting with those methods.

## Rationale

While SQL DBs are great for our high volume, stable object types, they might be overkill for some small authored item types. For authored items like some of our constants files, or Explorers, where we don't gain too many benefits from a relational structure and would have between 1-100 rows, we _could_ setup a catch all documents table with timestamps and versions and all our own versioning logic, or just write to disk and put it in Git/GitHub.

## Goals

-   Make it easier for authors to edit more things that lie between "content" and "code"
-   Allow new ways for authors to edit content in a safe way
-   Save dev time by just using Git for versioning author editable content
-   Increase dev speed by making it faster and less painful to do migrations
-   Increase dev speed by enabling faster syncing to dev of certain authored content from prod
-   Hopefully lead to some unplanned benefits by making some content more accessible

## Implementation notes

`server.ts` adds some routes to our API for writing, reading, and deleting files in the "GitCMS". The writes and deletes are committed and pushed.

`client.ts` contains methods for the browser to call these API routes.
