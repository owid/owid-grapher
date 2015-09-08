<?php namespace Zofe\Rapyd;

use Illuminate\Container\Container;
use Illuminate\Html\HtmlFacade as HTML;
use Illuminate\Support\Facades\Input;

class Rapyd
{

    protected static $container;
    protected static $js         = array();
    protected static $css        = array();
    protected static $scripts    = array();
    protected static $styles     = array();
    protected static $form;

    /**
     * Bind a Container to Rapyd
     *
     * @param Container $container
     */
    public static function setContainer(Container $container)
    {

        static::$container = $container;
    }

    /**
     * Get the Container from Rapyd
     *
     * @param  string    $service 
     * @return Container
     */
    public static function getContainer($service = null)
    {

        if ($service) {

            return static::$container->make($service);
        }

        return static::$container;
    }

    public static function head()
    {
        $buffer = "\n";

        //css links
        foreach (self::$css as $item) {
            $buffer .= HTML::style($item);
        }
        //js links
        foreach (self::$js as $item) {
            $buffer .= HTML::script($item);
        }

        //inline styles & scripts
        if (count(self::$styles)) {
            $buffer .= sprintf("<style type=\"text/css\">\n%s\n</style>", implode("\n", self::$styles));
        }
        if (count(self::$scripts)) {
            $buffer .= sprintf("\n<script language=\"javascript\" type=\"text/javascript\">\n\$(document).ready(function () {\n\n %s \n\n});\n</script>\n", implode("\n", self::$scripts));
        }

        return $buffer;
    }

    public static function scripts()
    {
        $buffer = "\n";

        //js links
        foreach (self::$js as $item) {
            $buffer .= HTML::script($item);
        }

        //inline scripts
        if (count(self::$scripts)) {
            $buffer .= sprintf("\n<script language=\"javascript\" type=\"text/javascript\">\n\$(document).ready(function () {\n\n %s \n\n});\n\n</script>\n", implode("\n", self::$scripts));
        }

        return $buffer;
    }

    public static function styles($demo = false)
    {
        $buffer = "\n";

        //css links
        foreach (self::$css as $item) {
            $buffer .= HTML::style($item);
        }

        if ($demo) {
            $buffer .= HTML::style('packages/zofe/rapyd/assets/demo/style.css'); 
        }
        //inline styles
        if (count(self::$styles)) {
            $buffer .= sprintf("<style type=\"text/css\">\n%s\n</style>", implode("\n", self::$styles));
        }

        return $buffer;
    }

    public static function js($js)
    {
        if (!in_array('packages/zofe/rapyd/assets/'.$js, self::$js))
            self::$js[] = 'packages/zofe/rapyd/assets/'.$js;
    }

    public static function css($css)
    {
        if (!in_array('packages/zofe/rapyd/assets/'.$css, self::$css))
            self::$css[] = 'packages/zofe/rapyd/assets/'.$css;
    }

    public static function script($script)
    {
        self::$scripts[] = $script;
    }

    public static function style($style)
    {
        self::$styles[] = $style;
    }

    public static function pop_script()
    {
        return array_pop(self::$scripts);
    }

    public static function pop_style()
    {
        return array_pop(self::$styles);
    }

    public static function qs($value, $default = false)
    {
        if ($value == 'id' && !Input::has('id')) {
            $value = 'show|modify|delete|do_delete|update';
        }
        $url = new Url();

        return $url->value($value, $default);
    }

    public static function url($set = '')
    {
        $url = new Url();
        if ($set != '') {
            $url->set($set);
        }

        return $url;
    }

    public static function setForm($form)
    {
        static::$form = $form;
    }

    public static function getForm()
    {
        return static::$form;
    }
}
