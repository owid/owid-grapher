<?php namespace Zofe\Rapyd;

use Illuminate\Html\FormFacade as Form;
use Illuminate\Html\HtmlFacade as HTML;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\Session;

class Widget
{

    public $label             = "";
    public $output            = "";
    public $built             = false;
    public $url;
    public $attributes        = array();

    public $process_status    = "idle";
    public $status            = "idle";
    public $action            = "idle";

    // TR: Top right - BL: Bottom left - BR: Bottom right
    public $button_container  = array( "TR"=>array(), "BL"=>array(), "BR"=>array() );
    public $message           = "";
    public $links             = array();

    public static $identifier = 0;

    public function __construct()
    {
        $this->url = new Url();
        $this->parser = new Parser(App::make('files'), App::make('path').'/storage/views');
    }

    /**
     * identifier is empty or a numeric value, it "identify" a single object instance.
     *
     * @return string identifier
     */
    protected function getIdentifier()
    {
        if (static::$identifier < 1) {
            static::$identifier++;

            return "";
        }

        return (string) static::$identifier++;
    }

    /**
     * @param string $name
     * @param string $position
     * @param array  $attributes
     *
     * @return $this
     */
    public function button($name, $position="BL", $attributes=array())
    {
        $attributes = array_merge(array("class"=>"btn btn-default"), $attributes);

        $this->button_container[$position][] = Form::button($name, $attributes);

        return $this;
    }

    /**
     * @param string $url
     * @param string $name
     * @param string $position
     * @param array  $attributes
     *
     * @return $this
     */
    public function link($url, $name, $position="BL", $attributes=array())
    {
        $base = str_replace(Request::path(),'',strtok(Request::fullUrl(),'?'));
        $match_url = str_replace($base, '/', strtok($url,'?'));
        if (Request::path()!= $match_url) {
            $url = Persistence::get($match_url, parse_url($url, PHP_URL_QUERY));
        }


        $attributes = array_merge(array("class"=>"btn btn-default"), $attributes);
        $this->button_container[$position][] =  HTML::link($url, $name, $attributes);
        $this->links[] = $url;

        return $this;
    }

    /**
     * @param string $route
     * @param string $name
     * @param array  $parameters
     * @param string $position
     * @param array  $attributes
     *
     * @return $this
     */
    public function linkRoute($route, $name, $parameters=array(), $position="BL", $attributes=array())
    {
        return $this->link(route($route, $parameters), $name, $position, $attributes);
    }

    /**
     * @param string $action
     * @param string $name
     * @param array  $parameters
     * @param string $position
     * @param array  $attributes
     *
     * @return $this
     */
    public function linkAction($action, $name, $parameters=array(), $position="BL", $attributes=array())
    {
        return $this->link(action($action, $parameters), $name, $position, $attributes);
    }

    /**
     * @param $label
     * @return $this
     */
    public function label($label)
    {
        $this->label = $label;

        return $this;
    }

    /**
     * @param string $url
     * @param string $name
     * @param string $position
     * @param array  $attributes
     *
     * @return $this
     */
    public function message($message)
    {
        $this->message =  $message;

        return $this;
    }

    /**
     * "echo $widget" automatically call build() it and display $widget->output
     * however explicit build is preferred for a clean code
     *
     * @return string
     */
    public function __toString()
    {
        if ($this->output == "") {
            $this->build();
        }

        return $this->output;
    }

    /**
     * set attributes for widget
     * @param $attributes
     * @return $this
     */
    public function attributes($attributes)
    {
        if (is_array($this->attributes) and is_array($attributes)) {
            $attributes = array_merge($this->attributes, $attributes);
        }
        $this->attributes = $attributes;

        return $this;
    }

    /**
     * add an attribute, or shortcut for attributes()
     * @param $attributes
     * @return $this
     */
    public function attr($attribute, $value = null)
    {
        if (is_array($attribute)) return $this->attributes($attribute);
        if ($value) return $this->attributes(array($attribute => $value));
    }

    /**
     * return a attributes in string format
     * @return string
     */
    public function buildAttributes()
    {
        if (is_string($this->attributes))
            return $this->attributes;

        if (count($this->attributes)<1)
            return "";

        $compiled = '';
        foreach ($this->attributes as $key => $val) {
            $compiled .= ' '.$key.'="'.$val.'"';
        }

        return $compiled;
    }

    /**
     * return a form with a nested action button
     * @param $url
     * @param $method
     * @param $name
     * @param  string $position
     * @param  array  $attributes
     * @return $this
     */
    public function formButton($url, $method, $name, $position="BL", $attributes=array())
    {
        $attributes = array_merge(array("class"=>"btn btn-default"), $attributes);
        $this->button_container[$position][] = Form::open(array('url' => $url, 'method' => $method)).Form::submit($name, $attributes).Form::close();

        return $this;
    }

}
