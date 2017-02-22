<?php // Code within app\Helpers\Helper.php

namespace App\Helpers;

use File;
use URL;

class Helper
{
    public static function js($entry)
    {
        $manifest = json_decode(File::get('build/manifest.json'));

        return '<script src="' . URL::to('/build/'.$manifest->{$entry.'.js'}) . '"></script>';
    }

    public static function css($entry)
    {
        $manifest = json_decode(File::get('build/manifest.json'));

        return '<link href="' . URL::to('/build/'.$manifest->{$entry.'.css'}) . '" rel="stylesheet" type="text/css">';
    }
}