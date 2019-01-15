<?php 
	the_post();

	// Redirect from admin site for live urls
	if (!is_preview() && $_SERVER['HTTP_HOST'] === "owid.cloud") {
		$url = "https://ourworldindata.org" . $_SERVER['REQUEST_URI'];
		wp_redirect($url, 302);
		exit;
	}

	$ID = escapeshellarg(get_the_ID());
	$themeDir = dirname(__FILE__);
	$isPreview = is_preview() ? "preview" : "";
	$cmd = "cd $themeDir && node dist/src/renderPage.js $ID $isPreview 2>&1";
	error_log($cmd);
	exec($cmd, $op);
	echo join("\n", $op);
?>