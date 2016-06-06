<?php

return [
	// Fetch the latest git commit hash for use as a cache tag
	'commit' => exec("git rev-parse HEAD")
];
