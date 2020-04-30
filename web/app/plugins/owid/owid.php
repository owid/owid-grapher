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

include 'src/Summary/summary.php';
include 'src/ProminentLink/prominent-link.php';
include 'src/AdditionalInformation/additional-information.php';
include 'src/Help/help.php';
include 'src/LastUpdated/last-updated.php';

const READING_CONTEXT_META_FIELD = 'owid_reading_context_meta_field';
const KEY_PERFORMANCE_INDICATORS_META_FIELD = "owid_key_performance_indicators_meta_field";

function setup()
{
	add_theme_support('post-thumbnails');
	add_theme_support('editor-styles');
	add_theme_support('disable-custom-colors');
	add_theme_support('editor-color-palette', array(
		array(
			'name'  => 'Bluish grey',
			'slug'  => 'bluish-grey',
			'color'	=> '#6e87a2',
		)
	));
	add_editor_style('editor-style.css');
}

function register()
{
	wp_register_script(
		'owid-plugin-script',
		plugins_url('build/plugins.js', __FILE__),
		array('wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-compose')
	);

	wp_register_style(
		'owid-plugin-css',
		plugins_url('src/style.css', __FILE__)
	);

	// Register custom post meta field. The content of the field will be saved
	// separately from the serialized HTML
	// This is used by the editor (see also the GraphQL registration of that field below)
	register_post_meta(
		'page',
		KEY_PERFORMANCE_INDICATORS_META_FIELD,
		array(
			'single' => true,
			'type' => 'object',
			// https://make.wordpress.org/core/2019/10/03/wp-5-3-supports-object-and-array-meta-types-in-the-rest-api/
			// Choosing to save both raw and rendered version to limit the number of dependencies
			// on the consuming end. As a bonus, prevents possible (albeit unlikely) discrepancies in Mardown rendering
			// between the preview in WP admin and the rendered version on the frontend.
			'show_in_rest' => array(
				'schema' => array(
					'type'       => 'object',
					'properties' => array(
						'raw' => array(
							'type' => 'string',
						),
						'rendered'  => array(
							'type' => 'string',
						),
					),
				),
			)
		)
	);

	// Uncomment to reactivate ReadingContext
	// register_post_meta(
	// 	'post',
	// 	READING_CONTEXT_META_FIELD,
	// 	array(
	// 		'show_in_rest' => true,
	// 		'single' => true,
	// 		'type' => 'integer',
	// 	)
	// );


	wp_register_script(
		'owid-blocks-script',
		plugins_url('build/blocks.js', __FILE__),
		array('wp-blocks', 'wp-compose', 'wp-hooks', 'wp-editor'),
		filemtime(plugin_dir_path(__FILE__) . 'build/blocks.js')
	);

	register_block_type('owid/summary', array(
		'editor_script' => 'owid-blocks-script',
		'render_callback' => __NAMESPACE__ . '\blocks\summary\render'
	));

	register_block_type('owid/prominent-link', array(
		'editor_script' => 'owid-blocks-script',
		'render_callback' => __NAMESPACE__ . '\blocks\prominent_link\render'
	));

	register_block_type('owid/additional-information', array(
		'editor_script' => 'owid-blocks-script',
		'render_callback' => __NAMESPACE__ . '\blocks\additional_information\render'
	));

	register_block_type('owid/help', array(
		'editor_script' => 'owid-blocks-script',
		'render_callback' => __NAMESPACE__ . '\blocks\help\render'
	));

	register_block_type('owid/last-updated', array(
		'editor_script' => 'owid-blocks-script',
		'render_callback' => __NAMESPACE__ . '\blocks\last_updated\render'
	));
}

// Registering the KPI meta field for querying through GraphQL. 
// Only the rendered version is returned for simplicity.
// (see also the REST API registration of that field above)
function graphql_register_types()
{
	register_graphql_field('Page', 'kpi', [
		'type' => 'String',
		'description' => 'Key Performance Indicators',
		'resolve' => function ($post) {
			$kpi_post_meta = get_post_meta($post->ID, KEY_PERFORMANCE_INDICATORS_META_FIELD, true);
			return !empty($kpi_post_meta['rendered']) ? $kpi_post_meta['rendered'] : '';
		}
	]);
}

function assets_enqueue()
{
	$screen = get_current_screen();

	if ($screen->post_type === 'page') {
		wp_enqueue_script('owid-plugin-script');
		wp_enqueue_style('owid-plugin-css');
	}
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
	if ($post_after->post_status == "publish" || $post_before->post_status == "publish") {
		$current_user = wp_get_current_user();
		putenv('PATH=' . getenv('PATH') . ':/bin:/usr/local/bin:/usr/bin');
		// Unsets colliding .env variables between PHP and node apps
		// The DB password does not collide and hence is not listed here (DB_PASS (node) vs DB_PASSWORD (php))
		putenv('DB_HOST');
		putenv('DB_USER');
		putenv('DB_NAME');
		putenv('DB_PORT');
		$cmd = "cd "
			. ABSPATH
			. "codelink && yarn tsn scripts/postUpdatedHook.ts "
			. escapeshellarg($current_user->user_email)
			. " " . escapeshellarg($current_user->display_name)
			. " " . escapeshellarg($post_after->ID)
			. " " . escapeshellarg($post_after->post_name)
			. " > /tmp/wp-static.log 2>&1 &";
		exec($cmd);
	}
}

// add_action('post_updated', __NAMESPACE__ . '\build_static', 10, 3);

/*
 * API fields
 */

/*
 * Returns either the post's standard path or the path of the embedding entry (for blog
 * posts embedded in an entry)
 */
function getPath(array $post)
{
	// Compute the deep path if the blog post reading context is an
	// entry (as opposed to its own page)
	if (getReadingContext($post) === 'entry') {
		// Get the entry path from the sidebar plugin
		return get_page_uri($post['meta'][READING_CONTEXT_META_FIELD]);
	} else {
		// Remove the host and leading slash from the post link (not expected by the
		// JS clients). Without hierarchical paths (parent/page-slug), the path is
		// identical to the slug.
		return substr(wp_make_link_relative($post['link']), 1);
	}
}

function getReadingContext(array $post)
{
	if (isset($post['meta'][READING_CONTEXT_META_FIELD]) && $post['meta'][READING_CONTEXT_META_FIELD] !== 0) {
		return 'entry';
	} else {
		return 'in-situ';
	}
}

function getAuthorsName(array $post)
{
	$authorNames = [];
	$authors = get_coauthors($post['id']);
	foreach ($authors as $author) {
		$authorNames[] = $author->data->display_name;
	}
	return $authorNames;
}

function getFeaturedMediaPath(array $post)
{
	$featured_media_url = wp_get_attachment_image_url($post['featured_media'], 'medium_large');
	if ($featured_media_url) {
		return wp_make_link_relative($featured_media_url);
	} else {
		return null;
	}
}

// TODO: restrict 'private' to authenticated users
function getPostType($request)
{
	$post = NULL;
	if ($request['slug']) {
		$posts = get_posts(array(
			'name' => $request['slug'],
			'posts_per_page' => 1,
			'post_type' => 'any',
			'post_status' => ['private', 'publish']
		));
		if (!empty($posts)) {
			$post = $posts[0];
		}
	} else if ($request['id']) {
		$post = get_post($request['id']);
	}

	if ($post !== NULL) {
		return rest_ensure_response($post->post_type);
	} else {
		return new \WP_Error('no_post', 'No post found with these search criteria', array('status' => 404));
	}
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route('owid/v1', '/type', array(
			'methods' => 'GET',
			'callback' => __NAMESPACE__ . '\getPostType',
		));
		register_rest_field(
			['post', 'page'],
			'path',
			['get_callback' => __NAMESPACE__ . '\getPath']
		);
		register_rest_field(
			'post',
			'reading_context',
			['get_callback' => __NAMESPACE__ . '\getReadingContext']
		);
		register_rest_field(
			['post', 'page'],
			'authors_name',
			['get_callback' => __NAMESPACE__ . '\getAuthorsName']
		);
		register_rest_field(
			['post', 'page'],
			'featured_media_path',
			['get_callback' => __NAMESPACE__ . '\getFeaturedMediaPath']
		);
	}
);
