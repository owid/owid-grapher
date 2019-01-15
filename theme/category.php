<?php 
	// Redirect from admin site for live urls
	if ($_SERVER['HTTP_HOST'] === "owid.cloud") {
		$url = "https://ourworldindata.org" . $_SERVER['REQUEST_URI'];
		wp_redirect($url, 302);
		exit;
	}

	$slug = escapeshellarg(trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
	$themeDir = dirname(__FILE__);
	$cmd = "cd $themeDir && node dist/src/renderPage.js $slug";
	error_log($cmd);
	exec($cmd, $op);
	echo join("\n", $op);
?>