<?php namespace Zofe\Rapyd;

use Illuminate\Support\Facades\Request;

class Url
{
    public $url;

    protected $semantic = array( 'page'    , 'orderby',
                                 'show'   , 'modify' ,
                                 'create' , 'insert' ,
                                 'update' , 'delete' ,
                                 'process');

    public static function unparse_str($array)
    {
        return '?' . preg_replace('/%5B[0-9]+%5D/simU', '%5B%5D', http_build_query($array));
    }

    public function set($url)
    {
        $this->url = $url;

        return $this;
    }

    public function get()
    {
        Rapyd::getContainer('url')->to($this->current());

        if ($this->url == '') {
            return $this->current();
        } else {
            $url       = $this->url ;
            $this->url = '';

            return $url;
        }
    }

    public function current($uri = false)
    {
        if ($uri) {
            return Request::url();
        }

        return Request::fullUrl();
    }

    public function getArray()
    {
        if ($this->url == '') {
            $this->url = $this->current();
        }

        parse_str(parse_url($this->url, PHP_URL_QUERY), $params);

        return $params;
    }

    public function append($key, $value)
    {
        $url      = $this->get();
        $qs_array = array();

        if (strpos($url, '?') !== false) {
            $qs  = substr( $url, strpos($url, '?') + 1 );
            $url = substr( $url, 0, strpos($url, '?' )) ;

            parse_str($qs, $qs_array);
        }

        $qs_array[$key] = $value;
        $query_string   = self::unparse_str($qs_array);
        $this->url      = $url . $query_string;

        return $this;
    }

    public function remove($keys)
    {
        $qs_array = array();
        $url      = $this->get();

        if (strpos($url, '?') === false) {
            $this->url = $url;

            return $this;
        }

        $qs  = substr( $url, strpos($url, '?') + 1 );
        $url = substr( $url, 0, strpos($url, '?') ) ;

        parse_str($qs, $qs_array);

        if (!is_array($keys)) {
            if ($keys == 'ALL') {
                $this->url = $url;

                return $this;
            }

            $keys = array($keys);
        }
        foreach ($keys as $key) {
            unset($qs_array[$key]);
        }
        $query_string = self::unparse_str($qs_array);
        $this->url    = $url . $query_string;

        return $this;
    }

    public function removeAll($cid = null)
    {
        $semantic = array_keys($this->semantic);

        if (isset($cid)) {
            foreach ($semantic as $key) {
                $keys[] = $key . $cid;
            }

            $semantic = $keys;
        }

        return $this->remove($semantic);
    }

    public function replace($key, $newkey)
    {
        $qs_array = array();
        $url      = $this->get();

        if (strpos($url, '?') !== false) {
            $qs  = substr($url, strpos($url, '?') + 1);
            $url = substr($url, 0, strpos($url, '?')) ;

            parse_str($qs, $qs_array);
        }

        if (isset($qs_array[$key])) {
            $qs_array[$newkey] = $qs_array[$key];
            unset($qs_array[$key]);
        }

        $query_string = self::unparse_str($qs_array);
        $this->url    = $url . $query_string;

        return $this;
    }

    public function value($key, $default = false)
    {
        if ( strpos($key, '|') ) {
            $keys = explode('|', $key);
            foreach ($keys as $k) {
                $v = $this->value($k, $default);
                if ($v != $default) {
                    return $v;
                }
            }//foreach

            return $default;
        }//if

        parse_str(parse_url($this->current(), PHP_URL_QUERY), $params);
        if (strpos($key, '.')) {
            list($namespace, $subkey) = explode('.', $key);

            return (isset($params[$namespace][$key])) ? $params[$namespace][$key] : $default;
        } else {
            return (isset($params[$key])) ? $params[$key] : $default;
        }
    }

}
