<?php

namespace OWID;
/*
Plugin Name: Our World In Data
*/

/*
 * Plugin set-up
 * https://developer.wordpress.org/block-editor/tutorials/javascript/
 *
 *  Save post meta in block
 *  https://developer.wordpress.org/block-editor/tutorials/metabox/meta-block-1-intro/
 */

include 'src/authentication.php';

// Gutenberg blocks
include 'src/Summary/summary.php';
include 'src/ProminentLink/prominent-link.php';
include 'src/AdditionalInformation/additional-information.php';
include 'src/Help/help.php';
include 'src/LastUpdated/last-updated.php';
include 'src/Byline/byline.php';
include 'src/Grid/grid.php';
include 'src/Card/card.php';
include 'src/KeyInsightsSlider/key-insights-slider.php';
include 'src/KeyInsight/key-insight.php';
include 'src/TechnicalText/technical-text.php';
include 'src/AllCharts/all-charts.php';
include 'src/StickyNav/sticky-nav.php';

const KEY_PERFORMANCE_INDICATORS_META_FIELD = "owid_key_performance_indicators_meta_field";
const GLOSSARY_META_FIELD = "owid_glossary_meta_field";
const PUBLICATION_CONTEXT_META_FIELD = "owid_publication_context_meta_field";

function setup()
{
    add_theme_support('post-thumbnails');
    add_theme_support('editor-styles');
    add_editor_style('editor-style.css');
}

function register()
{
    wp_register_script(
        'owid-plugins-script',
        plugins_url('build/plugins.js', __FILE__),
        [
            'wp-plugins',
            'wp-edit-post',
            'wp-element',
            'wp-components',
            'wp-data',
            'wp-compose',
        ],
        filemtime(plugin_dir_path(__FILE__) . 'build/plugins.js')
    );

    wp_register_style(
        'owid-plugins-css',
        plugins_url('src/style.css', __FILE__)
    );

    // Register custom post meta field. The content of the field will be saved
    // separately from the serialized HTML
    // This is used by the editor (see also the GraphQL registration of that field below)
    register_post_meta('page', KEY_PERFORMANCE_INDICATORS_META_FIELD, [
        'single' => true,
        'type' => 'object',
        // https://make.wordpress.org/core/2019/10/03/wp-5-3-supports-object-and-array-meta-types-in-the-rest-api/
        // Choosing to save both raw and rendered version to limit the number of dependencies
        // on the consuming end. As a bonus, prevents possible (albeit unlikely) discrepancies in Mardown rendering
        // between the preview in WP admin and the rendered version on the frontend.
        'show_in_rest' => [
            'schema' => [
                'type' => 'object',
                'properties' => [
                    'raw' => [
                        'type' => 'string',
                    ],
                    'rendered' => [
                        'type' => 'string',
                    ],
                ],
            ],
        ],
    ]);

    // Add (temporary) support for toggling glossary terms highlighting on the
    // current post. This is used by the editor (see also the GraphQL
    // registration of that field below)
    //
    // TODO: delete this field's data from the DB when not used anymore
    // (delete_post_meta_by_key( $post_meta_key )).
    register_post_meta('', GLOSSARY_META_FIELD, [
        'single' => true,
        'type' => 'boolean',
        'show_in_rest' => true,
    ]);

    // Add support for publication context.
    // Add GraphQL registration below when necessary
    register_post_meta('', PUBLICATION_CONTEXT_META_FIELD, [
        'single' => true,
        'type' => 'object',
        'show_in_rest' => [
            'schema' => [
                'type' => 'object',
                'properties' => [
                    'immediate_newsletter' => [
                        'type' => 'boolean',
                    ],
                    'homepage' => [
                        'type' => 'boolean',
                    ],
                    'latest' => [
                        'type' => 'boolean',
                    ],
                ],
            ],
        ],
    ]);

    wp_register_script(
        'owid-blocks-script',
        plugins_url('build/blocks.js', __FILE__),
        ['wp-blocks', 'wp-compose', 'wp-hooks', 'wp-editor', 'wp-element'],
        filemtime(plugin_dir_path(__FILE__) . 'build/blocks.js')
    );

    register_block_type('owid/summary', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\summary\render',
    ]);

    register_block_type('owid/prominent-link', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\prominent_link\render',
    ]);

    register_block_type('owid/additional-information', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' =>
            __NAMESPACE__ . '\blocks\additional_information\render',
    ]);

    register_block_type('owid/help', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\help\render',
    ]);

    register_block_type('owid/last-updated', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\last_updated\render',
    ]);

    register_block_type('owid/byline', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\byline\render',
    ]);

    register_block_type('owid/grid', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\grid\render',
    ]);

    register_block_type('owid/card', [
        'editor_script' => 'owid-blocks-script',
        'render_callback' => __NAMESPACE__ . '\blocks\card\render',
    ]);

    register_block_type(__DIR__ . '/src/KeyInsightsSlider', [
        'render_callback' =>
            __NAMESPACE__ . '\blocks\key_insights_slider\render',
    ]);

    register_block_type(__DIR__ . '/src/KeyInsight', [
        'render_callback' => __NAMESPACE__ . '\blocks\key_insight\render',
    ]);

    register_block_type(__DIR__ . '/src/TechnicalText', [
        'render_callback' => __NAMESPACE__ . '\blocks\technical_text\render',
    ]);

    register_block_type(__DIR__ . '/src/AllCharts', [
        'render_callback' => __NAMESPACE__ . '\blocks\all_charts\render',
    ]);

    register_block_type(__DIR__ . '/src/StickyNav', [
        'render_callback' => __NAMESPACE__ . '\blocks\sticky_nav\render',
    ]);
}

function graphql_register_types()
{
    // Registering the KPI meta field for querying through GraphQL.
    // Only the rendered version is returned for simplicity.
    // (see also the REST API registration of that field above)
    register_graphql_field('Page', 'kpi', [
        'type' => 'String',
        'description' => 'Key Performance Indicators',
        'resolve' => function ($post) {
            $kpi_post_meta = get_post_meta(
                $post->ID,
                KEY_PERFORMANCE_INDICATORS_META_FIELD,
                true
            );
            return !empty($kpi_post_meta['rendered'])
                ? $kpi_post_meta['rendered']
                : '';
        },
    ]);

    // If needed, make sure to register on both "Page" and "Post" types (only
    // set to "Page" below in the first argument of the register_graphql_field
    // function)
    // register_graphql_field('Page', 'glossary', [
    //     'type' => 'Boolean',
    //     'description' => 'Glossary',
    //     'resolve' => function ($post) {
    //         $glossary_post_meta = get_post_meta(
    //             $post->ID,
    //             GLOSSARY_META_FIELD,
    //             true
    //         );
    //         return !!$glossary_post_meta;
    //     },
    // ]);
}

// Show reusable blocks in GraphQL
// https://www.wpgraphql.com/docs/custom-post-types/#filtering-an-existing-post-type
add_filter(
    'register_post_type_args',
    function ($args, $post_type) {
        if ($post_type === 'wp_block') {
            $args['show_in_graphql'] = true;
            $args['graphql_single_name'] = 'wp_block';
            $args['graphql_plural_name'] = 'wp_blocks';
        }
        return $args;
    },
    10,
    2
);

function assets_enqueue()
{
    // $post_type = get_current_screen()->post_type;
    wp_enqueue_script('owid-plugins-script');
    wp_enqueue_style('owid-plugins-css');
}

add_action('after_setup_theme', __NAMESPACE__ . '\setup');
add_action('init', __NAMESPACE__ . '\register');
add_action('graphql_register_types', __NAMESPACE__ . '\graphql_register_types');
add_action('enqueue_block_editor_assets', __NAMESPACE__ . '\assets_enqueue');

/*
 */

function add_post_type_support()
{
    // Add revision support for reusable blocks
    \add_post_type_support('wp_block', 'revisions');

    // Add excerpt support for pages
    \add_post_type_support('page', 'excerpt');
}

add_action('init', __NAMESPACE__ . '\add_post_type_support');

/*
 * Disable wpautop processing
 */

// wpautop processing applied more selectively in the baker's formatting process
remove_filter('the_content', 'wpautop');

// Remove wrapping <p> tags in excerpt fields
remove_filter('the_excerpt', 'wpautop');

/*
 * Remove automatically created excerpt (generated in baker if missing)
 */

function remove_automatic_excerpt($excerpt)
{
    return has_excerpt() ? $excerpt : '';
}

add_filter('the_excerpt', __NAMESPACE__ . '\remove_automatic_excerpt');

/*
 * Post update hook to trigger background baking
 */

function build_static($post_ID, $post_after, $post_before)
{
    if (
        $post_after->post_status == "publish" ||
        $post_before->post_status == "publish"
    ) {
        $current_user = wp_get_current_user();
        putenv('PATH=' . getenv('PATH') . ':/bin:/usr/local/bin:/usr/bin');
        // Unsets colliding .env variables between PHP and node apps
        // The DB password did not collide and hence were not listed here (DB_PASS (node) vs DB_PASSWORD (php))
        // todo: cleanup, this doesn't make sense anymore since node and php env vars have now different names
        putenv('GRAPHER_DB_HOST');
        putenv('GRAPHER_DB_USER');
        putenv('GRAPHER_DB_NAME');
        putenv('GRAPHER_DB_PORT');
        $cmd =
            "cd " .
            ABSPATH .
            "codelink && yarn runPostUpdateHook " .
            escapeshellarg($current_user->user_email) .
            " " .
            escapeshellarg($current_user->display_name) .
            " " .
            escapeshellarg($post_after->ID) .
            " " .
            escapeshellarg($post_after->post_name) .
            " > /tmp/wp-static.log 2>&1 &";
        exec($cmd);
    }
}

add_action('post_updated', __NAMESPACE__ . '\build_static', 10, 3);

/*
 * Remove edit link below tables in previews
 * From https://tablepress.org/extensions/remove-edit-link/
 */

add_filter('tablepress_edit_link_below_table', '__return_false');

/*
 * API fields
 */

function getAuthorsName(array $post)
{
    $authorNames = [];
    $authors = get_coauthors($post['id']);
    foreach ($authors as $author) {
        $authorNames[] = $author->data->display_name;
    }
    return $authorNames;
}

function getFeaturedMediaPaths(array $post)
{
    $media = ["thumbnail" => null, "medium_large" => null];

    foreach ($media as $size => $v) {
        $featured_media_url = wp_get_attachment_image_url(
            $post['featured_media'],
            $size
        );
        $media[$size] = $featured_media_url
            ? wp_make_link_relative($featured_media_url)
            : null;
    }
    return $media;
}

// TODO: restrict 'private' to authenticated users
function getPostType($request)
{
    $post = null;
    if ($request['slug']) {
        $posts = get_posts([
            'name' => $request['slug'],
            'posts_per_page' => 1,
            'post_type' => 'any',
            'post_status' => ['private', 'publish'],
        ]);
        if (!empty($posts)) {
            $post = $posts[0];
        }
    } elseif ($request['id']) {
        $post = get_post($request['id']);
    }

    if ($post !== null) {
        return rest_ensure_response($post->post_type);
    } else {
        return new \WP_Error(
            'no_post',
            'No post found with these search criteria',
            ['status' => 404]
        );
    }
}

add_action('rest_api_init', function () {
    register_rest_route('owid/v1', '/type', [
        'methods' => 'GET',
        'callback' => __NAMESPACE__ . '\getPostType',
        'permission_callback' => '__return_true',
    ]);
    register_rest_field(['post', 'page'], 'authors_name', [
        'get_callback' => __NAMESPACE__ . '\getAuthorsName',
    ]);
    register_rest_field(['post', 'page'], 'featured_media_paths', [
        'get_callback' => __NAMESPACE__ . '\getFeaturedMediaPaths',
    ]);
});

/*
 * Search only posts titles to improve admin search accuracy.
 *
 * From
 * https://developer.wordpress.org/reference/hooks/posts_search/#comment-2213,
 * with additional check !is_admin().
 */
function admin_search_by_title_only($search, $wp_query)
{
    global $wpdb;
    if (!is_admin() || empty($search)) {
        return $search; // skip processing - no search term in query
    }
    $q = $wp_query->query_vars;
    $n = !empty($q['exact']) ? '' : '%';
    $search = $searchand = '';
    foreach ((array) $q['search_terms'] as $term) {
        $term = esc_sql($wpdb->esc_like($term));
        $search .= "{$searchand}($wpdb->posts.post_title LIKE '{$n}{$term}{$n}')";
        $searchand = ' AND ';
    }
    if (!empty($search)) {
        $search = " AND ({$search}) ";
        if (!is_user_logged_in()) {
            $search .= " AND ($wpdb->posts.post_password = '') ";
        }
    }
    return $search;
}
add_filter(
    'posts_search',
    __NAMESPACE__ . '\admin_search_by_title_only',
    10,
    2
);

if (getenv("TOPICS_CONTENT_GRAPH") === "true") {
    add_action('mb_relationships_init', function () {
        $sharedConfig = [
            'object_type' => 'post',
            'meta_box' => [
                'title' => "Parent topics",
            ],
            'admin_column' => [
                'position' => 'after title',
                'link' => 'edit',
            ],
            'show_in_graphql' => true,
            'graphql_name' => "parentTopics",
        ];

        \MB_Relationships_API::register([
            'id' => 'posts_to_pages',
            'from' => array_merge($sharedConfig, [
                'post_type' => 'post',
            ]),
            'to' => 'page',
        ]);
        \MB_Relationships_API::register([
            'id' => 'pages_to_pages',
            'from' => array_merge($sharedConfig, [
                'post_type' => 'page',
            ]),
            'to' => [
                'object_type' => 'post',
                'post_type' => 'page',
                'meta_box' => [
                    'title' => 'Children topics',
                ],
            ],
        ]);
    });
}

/*
 * Default post content
 */

add_filter(
    'default_content',
    function ($post_content, $post) {
        if ($post->post_type !== "post") {
            return;
        }

        $default_post_content = <<<EOD
<!-- wp:html -->
<div class="blog-info">
<p>Our World in Data presents the data and research to make progress against the world’s largest problems.<br>This article draws on data and research discussed in our entry on <strong><a href="https://ourworldindata.org/CHANGEME" target="_blank" rel="noopener">CHANGEME</a></strong>.</p>
<p>CHANGEME - NEW PARAGRAPH</p>
</div>
<!-- /wp:html -->
EOD;

        return $default_post_content;
    },
    10,
    2
);
