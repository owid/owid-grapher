// Generated from the db test database's schema by
// db/tests/schemaTypes/schemaTypes.test.ts. Don't edit by hand; to
// regenerate after a migration, run `make dbtest.update-schema-types`.
// dbTypesMatchSchema.ts checks our DB type definitions against it.

export interface DbSchema {
    _test_db_ready: {
        row: {
            id: number
        }
        insert: {
            id?: number
        }
    }
    admin_api_keys: {
        row: {
            id: number
            userId: number
            keyHash: string
            createdAt: Date
            lastUsedAt: Date | null
        }
        insert: {
            id?: number
            userId: number
            keyHash: string
            createdAt?: Date
            lastUsedAt?: Date | null
        }
    }
    analytics_chart_views: {
        row: {
            day: Date
            chart_slug: string
            view_config_id: string
            type: string
            views_7d: number
            views_14d: number
            views_365d: number
        }
        insert: {
            day: Date
            chart_slug: string
            view_config_id?: string
            type: string
            views_7d: number
            views_14d: number
            views_365d: number
        }
    }
    analytics_grapher_views: {
        row: {
            day: Date
            grapher_slug: string
            views_7d: number
            views_14d: number
            views_365d: number
        }
        insert: {
            day: Date
            grapher_slug: string
            views_7d: number
            views_14d: number
            views_365d: number
        }
    }
    analytics_pageviews: {
        row: {
            day: Date
            url: string
            views_7d: number
            views_14d: number
            views_365d: number
        }
        insert: {
            day: Date
            url: string
            views_7d: number
            views_14d: number
            views_365d: number
        }
    }
    archived_chart_versions: {
        row: {
            id: number
            archivalTimestamp: Date
            grapherId: number
            grapherSlug: string
            hashOfInputs: string
            manifest: string | null
        }
        insert: {
            id?: number
            archivalTimestamp: Date
            grapherId: number
            grapherSlug: string
            hashOfInputs: string
            manifest?: string | null
        }
    }
    archived_explorer_versions: {
        row: {
            id: number
            archivalTimestamp: Date
            explorerSlug: string
            hashOfInputs: string
            manifest: string | null
        }
        insert: {
            id?: number
            archivalTimestamp: Date
            explorerSlug: string
            hashOfInputs: string
            manifest?: string | null
        }
    }
    archived_multi_dim_versions: {
        row: {
            id: number
            archivalTimestamp: Date
            multiDimId: number
            multiDimSlug: string
            hashOfInputs: string
            manifest: string | null
        }
        insert: {
            id?: number
            archivalTimestamp: Date
            multiDimId: number
            multiDimSlug: string
            hashOfInputs: string
            manifest?: string | null
        }
    }
    archived_post_versions: {
        row: {
            id: number
            archivalTimestamp: Date
            postId: string
            postSlug: string
            hashOfInputs: string
            manifest: string | null
        }
        insert: {
            id?: number
            archivalTimestamp: Date
            postId: string
            postSlug: string
            hashOfInputs: string
            manifest?: string | null
        }
    }
    chart_configs: {
        row: {
            id: string
            config: string
            slug: string | null
            chartType: string | null
            createdAt: Date
            updatedAt: Date
            configMd5: string
        }
        insert: {
            id: string
            config: string
            createdAt?: Date
            updatedAt?: Date
        }
    }
    chart_diff_approvals: {
        row: {
            id: number
            chartId: number
            sourceUpdatedAt: Date
            targetUpdatedAt: Date | null
            updatedAt: Date
            status: string
        }
        insert: {
            id?: number
            chartId: number
            sourceUpdatedAt: Date
            targetUpdatedAt?: Date | null
            updatedAt: Date
            status: string
        }
    }
    chart_diff_conflicts: {
        row: {
            id: number
            chartId: number
            targetUpdatedAt: Date | null
            updatedAt: Date
            conflict: string
        }
        insert: {
            id?: number
            chartId: number
            targetUpdatedAt?: Date | null
            updatedAt: Date
            conflict: string
        }
    }
    chart_dimensions: {
        row: {
            id: number
            order: number
            property: string
            chartId: number
            variableId: number
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            order: number
            property: string
            chartId: number
            variableId: number
            createdAt?: Date
            updatedAt?: Date
        }
    }
    chart_revisions: {
        row: {
            id: number
            chartId: number | null
            userId: number | null
            config: string | null
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            chartId?: number | null
            userId?: number | null
            config?: string | null
            createdAt?: Date
            updatedAt?: Date
        }
    }
    chart_slug_redirects: {
        row: {
            id: number
            slug: string
            chart_id: number
            target_query_param: string | null
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            slug: string
            chart_id: number
            target_query_param?: string | null
            createdAt?: Date
            updatedAt?: Date
        }
    }
    chart_tags: {
        row: {
            chartId: number
            tagId: number
            keyChartLevel: number
            createdAt: Date
            updatedAt: Date
            isApproved: boolean
        }
        insert: {
            chartId: number
            tagId: number
            keyChartLevel?: number
            createdAt?: Date
            updatedAt?: Date
            isApproved?: boolean
        }
    }
    charts: {
        row: {
            id: number
            etlConfigCatalogPath: string | null
            configId: string
            patchConfigId: string
            patchConfigIdETL: string | null
            isInheritanceEnabled: boolean
            forceDatapage: boolean
            createdAt: Date
            updatedAt: Date
            lastEditedAt: Date
            publishedAt: Date | null
            lastEditedByUserId: number
            publishedByUserId: number | null
        }
        insert: {
            id?: number
            etlConfigCatalogPath?: string | null
            configId: string
            patchConfigId: string
            patchConfigIdETL?: string | null
            isInheritanceEnabled?: boolean
            forceDatapage?: boolean
            createdAt?: Date
            updatedAt?: Date
            lastEditedAt: Date
            publishedAt?: Date | null
            lastEditedByUserId: number
            publishedByUserId?: number | null
        }
    }
    charts_x_entities: {
        row: {
            chartId: number
            entityId: number
        }
        insert: {
            chartId: number
            entityId: number
        }
    }
    dataset_tags: {
        row: {
            datasetId: number
            tagId: number
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            datasetId: number
            tagId: number
            createdAt?: Date
            updatedAt?: Date
        }
    }
    datasets: {
        row: {
            id: number
            name: string
            description: string
            createdAt: Date
            updatedAt: Date
            namespace: string
            isPrivate: boolean
            createdByUserId: number
            metadataEditedAt: Date
            metadataEditedByUserId: number
            dataEditedAt: Date
            dataEditedByUserId: number
            nonRedistributable: boolean
            isArchived: boolean
            sourceChecksum: string | null
            shortName: string | null
            version: string | null
            updatePeriodDays: number | null
            catalogPath: string | null
            tables: string | null
            owners: string | null
        }
        insert: {
            id?: number
            name: string
            description: string
            createdAt?: Date
            updatedAt?: Date
            namespace: string
            isPrivate?: boolean
            createdByUserId: number
            metadataEditedAt: Date
            metadataEditedByUserId: number
            dataEditedAt: Date
            dataEditedByUserId: number
            nonRedistributable?: boolean
            isArchived?: boolean
            sourceChecksum?: string | null
            shortName?: string | null
            version?: string | null
            updatePeriodDays?: number | null
            catalogPath?: string | null
            tables?: string | null
            owners?: string | null
        }
    }
    dod_links: {
        row: {
            id: number
            sourceId: number
            target: string
            componentType: string
            linkType: "gdoc" | "url" | "grapher" | "explorer" | "narrative-chart" | "static-viz" | "dod" | "guided-chart"
            text: string
            queryString: string
            hash: string
        }
        insert: {
            id?: number
            sourceId: number
            target: string
            componentType?: string
            linkType: "gdoc" | "url" | "grapher" | "explorer" | "narrative-chart" | "static-viz" | "dod" | "guided-chart"
            text?: string
            queryString?: string
            hash?: string
        }
    }
    dods: {
        row: {
            id: number
            name: string
            content: string
            createdAt: Date
            updatedAt: Date
            lastUpdatedUserId: number | null
        }
        insert: {
            id?: number
            name: string
            content: string
            createdAt?: Date
            updatedAt?: Date
            lastUpdatedUserId?: number | null
        }
    }
    donors: {
        row: {
            id: number
            name: string
            originalName: string
            shouldPublish: boolean
            comment: string | null
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            name: string
            originalName: string
            shouldPublish?: boolean
            comment?: string | null
            createdAt?: Date
            updatedAt?: Date
        }
    }
    entities: {
        row: {
            id: number
            code: string | null
            name: string
            validated: boolean
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            code?: string | null
            name: string
            validated: boolean
            createdAt?: Date
            updatedAt?: Date
        }
    }
    explorer_charts: {
        row: {
            id: number
            explorerSlug: string
            chartId: number
        }
        insert: {
            id?: number
            explorerSlug: string
            chartId: number
        }
    }
    explorer_tags: {
        row: {
            id: number
            explorerSlug: string
            tagId: number
        }
        insert: {
            id?: number
            explorerSlug: string
            tagId: number
        }
    }
    explorer_variables: {
        row: {
            id: number
            explorerSlug: string
            variableId: number
        }
        insert: {
            id?: number
            explorerSlug: string
            variableId: number
        }
    }
    explorer_view_dimensions: {
        row: {
            id: number
            chartConfigId: string
            dimensions: string
        }
        insert: {
            id?: number
            chartConfigId: string
            dimensions: string
        }
    }
    explorer_views: {
        row: {
            id: number
            explorerSlug: string
            dimensions: string
            chartConfigId: string | null
            error: string | null
            viewId: string
        }
        insert: {
            id?: number
            explorerSlug: string
            dimensions: string
            chartConfigId?: string | null
            error?: string | null
            viewId: string
        }
    }
    explorers: {
        row: {
            slug: string
            config: string
            configMd5: string
            createdAt: Date
            updatedAt: Date
            tsv: string
            lastEditedByUserId: number | null
            lastEditedAt: Date | null
            commitMessage: string | null
            isPublished: boolean | null
            viewsRefreshStatus: "clean" | "queued" | "refreshing" | "failed"
            lastViewsRefreshAt: Date | null
        }
        insert: {
            slug: string
            config: string
            createdAt?: Date
            updatedAt?: Date
            tsv: string
            lastEditedByUserId?: number | null
            lastEditedAt?: Date | null
            commitMessage?: string | null
            viewsRefreshStatus?: "clean" | "queued" | "refreshing" | "failed"
            lastViewsRefreshAt?: Date | null
        }
    }
    featured_metrics: {
        row: {
            id: number
            url: string
            parentTagId: number
            ranking: number
            incomeGroup: "low" | "lower-middle" | "upper-middle" | "high" | "default" | null
            boostInSearch: boolean
        }
        insert: {
            id?: number
            url: string
            parentTagId: number
            ranking: number
            incomeGroup?: "low" | "lower-middle" | "upper-middle" | "high" | "default" | null
            boostInSearch?: boolean
        }
    }
    files: {
        row: {
            id: number
            filename: string
            path: string
            etag: string
            createdAt: Date
            createdBy: number | null
        }
        insert: {
            id?: number
            filename: string
            path: string
            etag: string
            createdAt?: Date
            createdBy?: number | null
        }
    }
    images: {
        row: {
            id: number
            googleId: string | null
            filename: string
            defaultAlt: string | null
            extractedText: string | null
            originalWidth: number
            updatedAt: number | null
            originalHeight: number
            cloudflareId: string
            hash: string
            userId: number | null
            replacedBy: number | null
            version: number
        }
        insert: {
            id?: number
            googleId?: string | null
            filename: string
            defaultAlt?: string | null
            extractedText?: string | null
            originalWidth: number
            updatedAt?: number | null
            originalHeight: number
            cloudflareId: string
            hash: string
            userId?: number | null
            replacedBy?: number | null
            version?: number
        }
    }
    importer_additionalcountryinfo: {
        row: {
            id: number
            country_code: string
            country_name: string
            country_wb_region: string | null
            country_wb_income_group: string | null
            country_special_notes: string | null
            country_latest_census: string | null
            country_latest_survey: string | null
            country_recent_income_source: string | null
            dataset: string
        }
        insert: {
            id?: number
            country_code: string
            country_name: string
            country_wb_region?: string | null
            country_wb_income_group?: string | null
            country_special_notes?: string | null
            country_latest_census?: string | null
            country_latest_survey?: string | null
            country_recent_income_source?: string | null
            dataset: string
        }
    }
    jobs: {
        row: {
            id: number
            type: string
            payload: string
            state: "queued" | "running" | "done" | "failed"
            attempts: number
            lastError: string | null
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            type: string
            payload: string
            state?: "queued" | "running" | "done" | "failed"
            attempts?: number
            lastError?: string | null
            createdAt?: Date
            updatedAt?: Date
        }
    }
    migrations: {
        row: {
            id: number
            timestamp: number
            name: string
        }
        insert: {
            id?: number
            timestamp: number
            name: string
        }
    }
    multi_dim_data_pages: {
        row: {
            id: number
            catalogPath: string
            slug: string | null
            config: string
            configMd5: string
            published: boolean
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            catalogPath: string
            slug?: string | null
            config: string
            published?: boolean
            createdAt?: Date
            updatedAt?: Date
        }
    }
    multi_dim_redirects: {
        row: {
            id: number
            source: string
            sourceQueryParams: string | null
            multiDimId: number
            viewConfigId: string | null
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            source: string
            sourceQueryParams?: string | null
            multiDimId: number
            viewConfigId?: string | null
            createdAt?: Date
            updatedAt?: Date
        }
    }
    multi_dim_view_dimensions: {
        row: {
            id: number
            chartConfigId: string
            dimensions: string
        }
        insert: {
            id?: number
            chartConfigId: string
            dimensions: string
        }
    }
    multi_dim_x_chart_configs: {
        row: {
            id: number
            multiDimId: number
            viewId: string
            variableId: number
            chartConfigId: string
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            multiDimId: number
            viewId: string
            variableId: number
            chartConfigId: string
            createdAt?: Date
            updatedAt?: Date
        }
    }
    namespaces: {
        row: {
            id: number
            name: string
            description: string | null
            isArchived: boolean
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            name: string
            description?: string | null
            isArchived?: boolean
            createdAt?: Date
            updatedAt?: Date
        }
    }
    narrative_charts: {
        row: {
            id: number
            name: string
            chartConfigId: string
            patchConfigId: string
            parentChartId: number | null
            parentMultiDimXChartConfigId: number | null
            queryParamsForParentChart: string
            queryParamsForParentChartMd5: string
            createdAt: Date
            updatedAt: Date
            lastEditedByUserId: number
        }
        insert: {
            id?: number
            name: string
            chartConfigId: string
            patchConfigId: string
            parentChartId?: number | null
            parentMultiDimXChartConfigId?: number | null
            queryParamsForParentChart: string
            createdAt?: Date
            updatedAt?: Date
            lastEditedByUserId: number
        }
    }
    origins: {
        row: {
            id: number
            titleSnapshot: string | null
            title: string | null
            descriptionSnapshot: string | null
            description: string | null
            producer: string | null
            citationFull: string | null
            attribution: string | null
            attributionShort: string | null
            versionProducer: string | null
            urlMain: string | null
            urlDownload: string | null
            dateAccessed: Date | null
            datePublished: string | null
            license: string | null
        }
        insert: {
            id?: number
            titleSnapshot?: string | null
            title?: string | null
            descriptionSnapshot?: string | null
            description?: string | null
            producer?: string | null
            citationFull?: string | null
            attribution?: string | null
            attributionShort?: string | null
            versionProducer?: string | null
            urlMain?: string | null
            urlDownload?: string | null
            dateAccessed?: Date | null
            datePublished?: string | null
            license?: string | null
        }
    }
    origins_variables: {
        row: {
            originId: number
            variableId: number
            displayOrder: number
        }
        insert: {
            originId: number
            variableId: number
            displayOrder?: number
        }
    }
    post_tags: {
        row: {
            post_id: number
            tag_id: number
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            post_id: number
            tag_id: number
            createdAt?: Date
            updatedAt?: Date
        }
    }
    posts: {
        row: {
            id: number
            title: string
            slug: string
            type: string
            status: string
            content: string
            archieml: string | null
            published_at: Date | null
            updated_at: Date | null
            authors: string | null
            excerpt: string | null
            updated_at_in_wordpress: Date | null
            created_at_in_wordpress: Date | null
            featured_image: string
            markdown: string | null
            formattingOptions: string | null
            wpApiSnapshot: string | null
        }
        insert: {
            id?: number
            title: string
            slug: string
            type: string
            status: string
            content: string
            archieml?: string | null
            published_at?: Date | null
            updated_at?: Date | null
            authors?: string | null
            excerpt?: string | null
            updated_at_in_wordpress?: Date | null
            created_at_in_wordpress?: Date | null
            featured_image?: string
            markdown?: string | null
            formattingOptions?: string | null
            wpApiSnapshot?: string | null
        }
    }
    posts_gdocs: {
        row: {
            id: string
            slug: string
            type: string | null
            content: string
            contentMd5: string
            authors: string | null
            published: number
            createdAt: Date
            publishedAt: Date | null
            updatedAt: Date
            publicationContext: "unlisted" | "listed"
            revisionId: string | null
            manualBreadcrumbs: string | null
            markdown: string | null
        }
        insert: {
            id: string
            slug: string
            content: string
            published: number
            createdAt?: Date
            publishedAt?: Date | null
            updatedAt?: Date
            publicationContext?: "unlisted" | "listed"
            revisionId?: string | null
            manualBreadcrumbs?: string | null
            markdown?: string | null
        }
    }
    posts_gdocs_components: {
        row: {
            id: number
            gdocId: string | null
            type: string | null
            config: string | null
            parent: string | null
            path: string | null
        }
        insert: {
            id?: number
            gdocId?: string | null
            config?: string | null
            parent?: string | null
            path?: string | null
        }
    }
    posts_gdocs_links: {
        row: {
            id: number
            sourceId: string | null
            target: string
            linkType: "gdoc" | "url" | "grapher" | "explorer" | "narrative-chart" | "dod" | "guided-chart" | "static-viz"
            componentType: string
            text: string
            queryString: string
            hash: string
        }
        insert: {
            id?: number
            sourceId?: string | null
            target: string
            linkType: "gdoc" | "url" | "grapher" | "explorer" | "narrative-chart" | "dod" | "guided-chart" | "static-viz"
            componentType: string
            text: string
            queryString: string
            hash: string
        }
    }
    posts_gdocs_tombstones: {
        row: {
            id: number
            gdocId: string | null
            slug: string
            reason: string
            includeArchiveLink: boolean
            relatedLinkUrl: string
            relatedLinkTitle: string
            relatedLinkDescription: string
            relatedLinkThumbnail: string
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            gdocId?: string | null
            slug: string
            reason?: string
            includeArchiveLink?: boolean
            relatedLinkUrl?: string
            relatedLinkTitle?: string
            relatedLinkDescription?: string
            relatedLinkThumbnail?: string
            createdAt?: Date
            updatedAt?: Date
        }
    }
    posts_gdocs_variables_faqs: {
        row: {
            gdocId: string
            variableId: number
            fragmentId: string
            displayOrder: number
        }
        insert: {
            gdocId: string
            variableId: number
            fragmentId: string
            displayOrder?: number
        }
    }
    posts_gdocs_x_images: {
        row: {
            id: number
            gdocId: string
            imageId: number
        }
        insert: {
            id?: number
            gdocId: string
            imageId: number
        }
    }
    posts_gdocs_x_tags: {
        row: {
            gdocId: string
            tagId: number
        }
        insert: {
            gdocId: string
            tagId: number
        }
    }
    posts_links: {
        row: {
            id: number
            sourceId: number
            target: string
            linkType: "url" | "grapher" | "explorer" | "gdoc" | null
            componentType: string
            text: string
            queryString: string
            hash: string
        }
        insert: {
            id?: number
            sourceId: number
            target: string
            linkType?: "url" | "grapher" | "explorer" | "gdoc" | null
            componentType: string
            text: string
            queryString: string
            hash: string
        }
    }
    redirects: {
        row: {
            id: number
            source: string
            target: string
            createdAt: Date
            updatedAt: Date
            ttl: Date | null
        }
        insert: {
            id?: number
            source: string
            target: string
            createdAt?: Date
            updatedAt?: Date
            ttl?: Date | null
        }
    }
    related_charts: {
        row: {
            id: number
            chartId: number
            relatedChartId: number
            label: string
            reviewer: string
            score: number | null
            updatedAt: Date | null
        }
        insert: {
            id?: number
            chartId: number
            relatedChartId: number
            label: string
            reviewer: string
            score?: number | null
            updatedAt?: Date | null
        }
    }
    slideshow_links: {
        row: {
            id: number
            slideshowId: number
            target: string
            linkType: "gdoc" | "url" | "grapher" | "explorer" | "narrative-chart" | "static-viz" | "dod" | "guided-chart"
            queryString: string
            hash: string
        }
        insert: {
            id?: number
            slideshowId: number
            target: string
            linkType: "gdoc" | "url" | "grapher" | "explorer" | "narrative-chart" | "static-viz" | "dod" | "guided-chart"
            queryString?: string
            hash?: string
        }
    }
    slideshow_x_images: {
        row: {
            id: number
            slideshowId: number
            imageId: number
        }
        insert: {
            id?: number
            slideshowId: number
            imageId: number
        }
    }
    slideshows: {
        row: {
            id: number
            slug: string
            title: string
            config: string
            userId: number
            createdAt: Date
            updatedAt: Date
            isPublished: boolean
            publishedAt: Date | null
        }
        insert: {
            id?: number
            slug: string
            title: string
            config: string
            userId: number
            createdAt?: Date
            updatedAt?: Date
            isPublished?: boolean
            publishedAt?: Date | null
        }
    }
    sources: {
        row: {
            id: number
            name: string | null
            description: string
            createdAt: Date
            updatedAt: Date
            datasetId: number | null
        }
        insert: {
            id?: number
            name?: string | null
            description: string
            createdAt?: Date
            updatedAt?: Date
            datasetId?: number | null
        }
    }
    static_viz: {
        row: {
            id: number
            name: string
            description: string | null
            grapherSlug: string | null
            sourceUrl: string | null
            imageId: number
            mobileImageId: number | null
            createdBy: number | null
            updatedBy: number | null
            createdAt: Date
            updatedAt: Date
        }
        insert: {
            id?: number
            name: string
            description?: string | null
            grapherSlug?: string | null
            sourceUrl?: string | null
            imageId: number
            mobileImageId?: number | null
            createdBy?: number | null
            updatedBy?: number | null
            createdAt?: Date
            updatedAt?: Date
        }
    }
    tag_graph: {
        row: {
            parentId: number
            childId: number
            weight: number
            updatedAt: Date
        }
        insert: {
            parentId: number
            childId: number
            weight?: number
            updatedAt?: Date
        }
    }
    tags: {
        row: {
            id: number
            name: string
            createdAt: Date
            updatedAt: Date
            specialType: string | null
            slug: string | null
            searchableInAlgolia: boolean
        }
        insert: {
            id?: number
            name: string
            createdAt?: Date
            updatedAt?: Date
            specialType?: string | null
            slug?: string | null
            searchableInAlgolia?: boolean
        }
    }
    tags_variables_topic_tags: {
        row: {
            tagId: number
            variableId: number
            displayOrder: number
        }
        insert: {
            tagId: number
            variableId: number
            displayOrder?: number
        }
    }
    users: {
        row: {
            id: number
            lastLogin: Date | null
            isSuperuser: boolean
            email: string
            createdAt: Date
            updatedAt: Date
            isActive: boolean
            fullName: string
            lastSeen: Date | null
            githubUsername: string | null
            dataInsightFolderId: string | null
            slackId: string | null
        }
        insert: {
            id?: number
            lastLogin?: Date | null
            isSuperuser?: boolean
            email: string
            createdAt?: Date
            updatedAt?: Date
            isActive?: boolean
            fullName: string
            lastSeen?: Date | null
            githubUsername?: string | null
            dataInsightFolderId?: string | null
            slackId?: string | null
        }
    }
    variables: {
        row: {
            id: number
            name: string | null
            unit: string
            description: string | null
            createdAt: Date
            updatedAt: Date
            code: string | null
            coverage: string
            timespan: string
            datasetId: number
            sourceId: number | null
            shortUnit: string | null
            display: string
            columnOrder: number
            originalMetadata: string | null
            shortName: string | null
            catalogPath: string | null
            dimensions: string | null
            schemaVersion: number
            processingLevel: string | null
            processingLog: string | null
            titlePublic: string | null
            titleVariant: string | null
            attributionShort: string | null
            attribution: string | null
            descriptionShort: string | null
            descriptionFromProducer: string | null
            descriptionKey: string | null
            descriptionProcessing: string | null
            licenses: string | null
            license: string | null
            type: "float" | "int" | "mixed" | "string" | "ordinal" | null
            sort: string | null
            patchConfigIdETL: string | null
            dataChecksum: string | null
            metadataChecksum: string | null
        }
        insert: {
            id?: number
            name?: string | null
            unit: string
            description?: string | null
            createdAt?: Date
            updatedAt?: Date
            code?: string | null
            coverage: string
            timespan: string
            datasetId: number
            sourceId?: number | null
            shortUnit?: string | null
            display: string
            columnOrder?: number
            originalMetadata?: string | null
            shortName?: string | null
            catalogPath?: string | null
            dimensions?: string | null
            schemaVersion?: number
            processingLevel?: string | null
            processingLog?: string | null
            titlePublic?: string | null
            titleVariant?: string | null
            attributionShort?: string | null
            attribution?: string | null
            descriptionShort?: string | null
            descriptionFromProducer?: string | null
            descriptionKey?: string | null
            descriptionProcessing?: string | null
            licenses?: string | null
            license?: string | null
            type?: "float" | "int" | "mixed" | "string" | "ordinal" | null
            sort?: string | null
            patchConfigIdETL?: string | null
            dataChecksum?: string | null
            metadataChecksum?: string | null
        }
    }
}
