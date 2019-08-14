<?php
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

const READING_CONTEXT_META_FIELD = 'owid_reading_context_meta_field';

function owid_plugin_register()
{
	wp_register_script(
		'owid-plugin-script',
		plugins_url('build/index.js', __FILE__),
		array('wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-compose')
	);

	wp_register_style(
		'owid-plugin-css',
		plugins_url('src/style.css', __FILE__)
	);

	// Register custom post meta field. The content of the field will be saved
	// separately from the serialized HTML
	register_post_meta(
		'post',
		READING_CONTEXT_META_FIELD,
		array(
			'show_in_rest' => true,
			'single' => true,
			'type' => 'integer',
		)
	);
}

function owid_plugin_assets_enqueue()
{
	$screen = get_current_screen();
	if ($screen->post_type === 'post') {
		wp_enqueue_script('owid-plugin-script');
		wp_enqueue_style('owid-plugin-css');
	}
}

add_action('init', 'owid_plugin_register');
add_action('enqueue_block_editor_assets', 'owid_plugin_assets_enqueue');

/*
 * API fields
 */

function getDeepLink(array $outerPost)
{
	$deepLink = $outerPost['link'];

	// Compute the deep link if the blog post reading context is an
	// entry (as opposed to its own page)

	if (isset($outerPost['meta'][READING_CONTEXT_META_FIELD]) && $outerPost['meta'][READING_CONTEXT_META_FIELD] !== 0) {

		// Get the entry link from the sidebar plugin
		$entryLink = get_permalink($outerPost['meta'][READING_CONTEXT_META_FIELD]);

		// Checking the first block of the post (outerPost) for a reusable
		// block (innerPost). Then get the first heading.
		$outerPostBlocks = parse_blocks($outerPost['content']['raw']);
		if ($outerPostBlocks[0]['blockName'] === "core/block") {
			$innerPost = get_post($outerPostBlocks[0]['attrs']['ref']);
			$innerPostBlocks = parse_blocks($innerPost->post_content);
			if ($innerPostBlocks[0]['blockName'] === 'core/heading') {
				// Manually get the id (not exposed in block attributes)
				$heading = $innerPostBlocks[0];
				preg_match('/id="([^"]+)/', $heading['innerHTML'], $matches);
				$deepLink = isset($matches[1]) ? $entryLink . "#" . $matches[1] : $deepLink;
			}
		}
	}
	return wp_make_link_relative($deepLink);
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

function getTitleRaw(array $post)
{
	return $post['title']['raw'];
}

add_action(
	'rest_api_init',
	function () {
		register_rest_field(
			'post',
			'deep_link',
			['get_callback' => 'getDeepLink']
		);
		register_rest_field(
			'post',
			'authors_name',
			['get_callback' => 'getAuthorsName']
		);
		register_rest_field(
			'post',
			'featured_media_path',
			['get_callback' => 'getFeaturedMediaPath']
		);
		register_rest_field(
			'post',
			'title_raw',
			['get_callback' => 'getTitleRaw']
		);
	}
);
