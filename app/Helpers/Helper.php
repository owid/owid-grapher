<?php // Code within app\Helpers\Helper.php

namespace App\Helpers;

use File;
use URL;

class Helper
{
    public static function js($entry)
    {
        $manifest = json_decode(File::get('build/manifest.json'));
        $path = env('APP_ENV', 'production') == 'production' ? '/build/'.$manifest->{$entry.'.js'} : '/build/'.$entry.'.bundle.js';
        return '<script src="' . URL::to($path) . '"></script>';
    }

    public static function css($entry)
    {
        $manifest = json_decode(File::get('build/manifest.json'));
        $path = env('APP_ENV', 'production') == 'production' ? '/build/'.$manifest->{$entry.'.css'} : '/build/'.$entry.'.bundle.css';
        return '<link href="' . URL::to($path) . '" rel="stylesheet" type="text/css">';
    }
}