<?php

namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;
use Illuminate\Support\Facades\Input;
use Intervention\Image\ImageManagerStatic as ImageManager;

class Image extends File
{
    public $type = "image";
    public $rule = "mimes:jpeg,png";

    protected $image;
    protected $image_callable;
    protected $resize = array();
    protected $fit = array();
    protected $preview = array(120, 80);

    public function __construct($name, $label, &$model = null, &$model_relations = null)
    {
        parent::__construct($name, $label, $model, $model_relations);

        \Event::listen('rapyd.uploaded.'.$this->name, function () {
            $this->imageProcess();
        });
    }

    /**
     * store a closure to make something with ImageManager post process
     * @param  callable $callable
     * @return $this
     */
    public function image(\Closure $callable)
    {
        $this->image_callable = $callable;

        return $this;
    }

    /**
     * shortcut to ImageManager resize
     * @param $width
     * @param $height
     * @param $filename
     * @return $this
     */
    public function resize($width, $height, $filename = null)
    {
        $this->resize[] = array('width'=>$width, 'height'=>$height,  'filename'=>$filename);

        return $this;
    }

    /**
     * shortcut to ImageManager fit
     * @param $width
     * @param $height
     * @param $filename
     * @return $this
     */
    public function fit($width, $height, $filename = null)
    {
        $this->fit[] = array('width'=>$width, 'height'=>$height,  'filename'=>$filename);

        return $this;
    }

    /**
     * change the preview thumb size
     * @param $width
     * @param $height
     * @return $this
     */
    public function preview($width, $height)
    {
        $this->preview = array($width, $height);

        return $this;
    }

    /**
     * postprocess image if needed
     */
    protected function imageProcess()
    {
        if ($this->saved) {
            if (!$this->image)  $this->image = ImageManager::make($this->saved);

            if ($this->image_callable) {
                $callable = $this->image_callable;
                $callable($this->image);
            }

            if (count($this->resize)) {
                foreach ($this->resize as $resize) {
                    $this->image->resize($resize["width"], $resize["height"]);
                    $this->image->save($resize["filename"]);
                }
            }

            if (count($this->fit)) {
                foreach ($this->fit as $fit) {
                    $this->image->fit($fit["width"], $fit["height"]);
                    $this->image->save($fit["filename"]);
                }
            }

        }
    }

    public function thumb()
    {
        if (!\File::exists($this->path.$this->old_value)) return '';
        return '<img src="'.ImageManager::make($this->path.$this->old_value)->fit($this->preview[0], $this->preview[1])->encode('data-url').'" class="pull-left" style="margin:0 10px 10px 0">';
    }

    public function build()
    {
        $output = "";
        if (parent::build() === false)
            return;

        switch ($this->status) {
            case "disabled":
            case "show":

                if ($this->type == 'hidden' || $this->value == "") {
                    $output = "";
                } elseif ((!isset($this->value))) {
                    $output = $this->layout['null_label'];
                } else {
                    $output =  $this->thumb();
                }
                $output = "<div class='help-block'>" . $output . "&nbsp;</div>";
                break;

            case "create":
            case "modify":
                if ($this->old_value != "") {
                    $output .= '<div class="clearfix">';
                    $output .= $this->thumb()." &nbsp;".link_to($this->web_path.$this->value, $this->value, array('target'=>'_blank'))."<br />\n";
                    $output .= Form::checkbox($this->name.'_remove', 1, (bool) Input::get($this->name.'_remove'))." ".trans('rapyd::rapyd.delete')." <br/>\n";
                    $output .= '</div>';
                }
                $output .= Form::file($this->name, $this->attributes);
                break;

            case "hidden":
                $output = Form::hidden($this->name, $this->value);
                break;

            default:;
        }
        $this->output = "\n" . $output . "\n" . $this->extra_output . "\n";
    }

}
