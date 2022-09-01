import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow, SearchField } from "./Forms.js"

export const GdocsIndexPage = () => {
    return (
        <AdminLayout title="Google Docs Articles">
            <main>
                <FieldsRow>
                    <span>
                        {/* Showing {postsToShow.length} of {numTotalRows} posts */}
                    </span>
                    {/* <SearchField
                            placeholder="Search all posts..."
                            value={searchInput}
                            onValue={this.onSearchInput}
                            autofocus
                        /> */}
                </FieldsRow>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Authors</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Tags</th>
                            <th>Last Updated</th>
                            <th></th>
                        </tr>
                    </thead>
                    {/* <tbody>
                            {postsToShow.map((post) => (
                                <PostRow
                                    key={post.id}
                                    post={post}
                                    highlight={highlight}
                                    availableTags={this.availableTags}
                                />
                            ))}
                        </tbody> */}
                </table>
                {/* {!searchInput && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more posts...
                        </button>
                    )} */}
            </main>
        </AdminLayout>
    )
}
