<?php // Code within app\Helpers\Helper.php

namespace App\Helpers;

use File;
use URL;

class Helper
{
    public static function js($entry)
    {
        $path = "";
        if (env('APP_ENV', 'production') == 'production') {
            $manifest = json_decode(File::get('build/manifest.json'));
            $path = '/build/'.$manifest->{$entry.'.js'};
        } else {
            $path = '/build/'.$entry.'.bundle.js';
        }
        return '<script src="' . URL::to($path) . '"></script>';
    }

    public static function css($entry)
    {
        $path = "";
        if (env('APP_ENV', 'production') == 'production') {
            $manifest = json_decode(File::get('build/manifest.json'));
            $path = '/build/'.$manifest->{$entry.'.css'};
        } else {
            $path = '/build/'.$entry.'.bundle.css';
        }
        return '<link href="' . URL::to($path) . '" rel="stylesheet" type="text/css">';
    }
}