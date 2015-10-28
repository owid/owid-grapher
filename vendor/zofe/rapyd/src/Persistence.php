<?php namespace Zofe\Rapyd;

use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Session;

class Persistence
{

    public static function get($url, $qs = '')
    {
        $s =  Session::get('rapyd.' . $url, $url);
        $old_params = parse_url($s, PHP_URL_QUERY);
        
        if ($qs) {
            $base = str_replace(Request::path(),'',strtok(Request::fullUrl(),'?'));
            $url = str_replace($base, '/', strtok($url,'?'));
            $old_params_arr = array();
            $qs_arr = array();
            parse_str($old_params, $old_params_arr);
            parse_str($qs, $qs_arr);
            $s = $url.'?'.http_build_query(array_merge($old_params_arr,$qs_arr));
        }
        return $s;
    }

    public static function save()
    {
        Session::put('rapyd.' . Request::path(), Request::fullUrl());
    }

    public static function clear()
    {
        Session::forget('rapyd.' . Request::path());
    }

}
