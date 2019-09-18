<?php 
	// Redirect from admin site for live urls
    $url = "https://ourworldindata.org" . $_SERVER['REQUEST_URI'];
    wp_redirect($url, 302);
    exit;
?>