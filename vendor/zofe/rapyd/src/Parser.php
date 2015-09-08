<?php namespace Zofe\Rapyd;

use Illuminate\View\Compilers\BladeCompiler;

//http://stackoverflow.com/questions/16891398/is-there-anyway-around-to-compile-blade-template-like-this

class Parser extends BladeCompiler
{
    /**
     * Compile blade template with passing arguments.
     *
     * @param  string $value
     * @param  array  $args  variables to be extracted
     * @return string the compiled output
     */
    public function compileString($value, array $args = array())
    {
        $generated = parent::compileString($value);

        ob_start() and extract($args, EXTR_SKIP);

        try {
            eval('?>'.$generated.'<?php ');
        }
        // If we caught an exception, just return $value unparsed for now, or empty string
        catch (\Exception $e) {
            ob_get_clean(); //throw $e;

            return $value;
        }

        $content = ob_get_clean();

        return $content;
    }

}
