<?php

namespace OWID;

add_action('init', function () {
    $args = [
        'labels' => [
            'name' => 'Shorts',
            'singular_name' => 'Short',
            'not_found' => 'No shorts found',
        ],
        'public' => true,
        'supports' => ['title', 'editor', 'author', 'revisions', 'thumbnail'],
        'show_in_rest' => true,
        'taxonomies' => ['category'],
        'show_in_graphql' => true,
        'graphql_single_name' => 'short',
        'graphql_plural_name' => 'shorts',
    ];

    register_post_type('shorts', $args);
});
