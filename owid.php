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

function owid_plugin_register() {
	wp_register_script(
			'owid-plugin-script',
			plugins_url( 'build/index.js', __FILE__ ),
			array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data', 'wp-compose' )
	);
	wp_register_style(
		'owid-plugin-css',
		plugins_url( 'src/style.css', __FILE__ )
);
}
add_action( 'init', 'owid_plugin_register' );

function owid_plugin_script_enqueue() {
	wp_enqueue_script( 'owid-plugin-script' );
}
add_action( 'enqueue_block_editor_assets', 'owid_plugin_script_enqueue' );

function owid_plugin_style_enqueue() {
	wp_enqueue_style( 'owid-plugin-css' );
}
add_action( 'enqueue_block_editor_assets', 'owid_plugin_style_enqueue' );

// Register custom post meta field. The content of the field will be saved
// separately from the serialized HTML
function owid_register_post_meta() {
  register_post_meta( 'post', 'owid_plugin_deep_link_meta_field', array(
      'show_in_rest' => true,
      'single' => true,
      'type' => 'string',
  ) );
}
add_action( 'init', 'owid_register_post_meta' );