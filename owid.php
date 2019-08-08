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

	// Register custom post meta field. The content of the field will be saved
	// separately from the serialized HTML
	register_post_meta( 'post', 'owid_plugin_deep_link_meta_field', array(
		'show_in_rest' => true,
		'single' => true,
		'type' => 'integer',
		) 
	);
}

function owid_plugin_assets_enqueue() {
	$screen = get_current_screen();
	if( $screen->post_type === 'post' ) {
		wp_enqueue_script( 'owid-plugin-script' );
		wp_enqueue_style( 'owid-plugin-css' );
	}
}

add_action( 'init', 'owid_plugin_register' );
add_action( 'enqueue_block_editor_assets', 'owid_plugin_assets_enqueue' );
