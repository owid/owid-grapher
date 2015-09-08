<?php namespace Zofe\Rapyd;

use ReflectionClass;
use ReflectionMethod;

class Documenter
{
    public static function showCode($filepath)
    {
        if (file_exists(app_path() ."/".$filepath)) {
            $file = app_path() ."/".$filepath;
        } elseif (file_exists(app_path() ."/../packages/".$filepath)) {
            $file = app_path() ."/../packages/".$filepath;
        } elseif (file_exists(app_path() ."/../vendor/".$filepath)) {
            $file = app_path() ."/../vendor/".$filepath;
        } else {
            return "";
        }

        $code = file_get_contents($file);
        $code = preg_replace("#{!! Documenter::show(.*) !!}#Us", '', $code);
        $code = highlight_string($code, true);

        return "<pre>\n" . $code . "\n</pre>";
    }

    public static function showMethod($class, $methods)
    {
        $rclass     = new ReflectionClass($class);
        $definition = implode("", array_slice(file($rclass->getFileName()), $rclass->getStartLine()-1, 1));

        $code       = "\n".$definition."\n....\n\n";

        if (!is_array($methods))
            $methods = array($methods);

        foreach ($methods as $method) {
            $method     = new ReflectionMethod($class, $method);
            $filename   = $method->getFileName();
            $start_line = $method->getStartLine()-1;
            $end_line   = $method->getEndLine();
            $length     = $end_line - $start_line;
            $source     = file($filename);
            $content    = implode("", array_slice($source, $start_line, $length));

            $code .= $content."\n\n";
        }

        $code = highlight_string("<?php ".$code, true);
        $code = str_replace('&lt;?php&nbsp;', '', $code);

        return "<pre>\n" . $code . "\n</pre>";
    }

    protected static function getPackagePath($class)
    {
        $path = with(new ReflectionClass($class))->getFileName();

        return realpath(dirname($path).'/../../');
    }

}
