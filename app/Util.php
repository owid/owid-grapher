<?php namespace App;
use Assets;
use Request;

class Util {
	// Stolz assets doesn't seem to have a way to make non-relative urls
	// so we're doing that here
	public static function js() {
		return Assets::js(function($assets) {
			$output = '';
			foreach ($assets as $a) {
				$output .= '<script src="' . Request::root() . '/' . $a . '"></script>' . "\n";
			}
			return $output;
		});
	}

	public static function css() {
		return Assets::css(function($assets) {
			$output = '';
			foreach ($assets as $a) {
				$output .= '<link href="' . Request::root() . '/' . $a . '" type="text/css" rel="stylesheet"/>' . "\n";
			}
			return $output;
		});
	}
}