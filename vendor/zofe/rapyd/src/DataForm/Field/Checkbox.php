<?php namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;
use Illuminate\Support\Facades\Input;

class Checkbox extends Field
{

    public $type = "checkbox";
    public $size = null;
    public $checked = false;
    public $css_class = "checkbox";
    public $checked_value = 1;
    public $unchecked_value = 0;
    public $checked_output = 'yes';
    public $unchecked_output = 'no';

    public function getValue()
    {
        parent::getValue();
        if (\Request::isMethod('post') && !\Input::exists($this->name)) {
            $this->value =  $this->unchecked_value;
        }
        $this->checked = (bool) ($this->value == $this->checked_value);
    }

    public function getNewValue()
    {
        parent::getNewValue();

        if (is_null($this->new_value)) {
            $this->new_value = $this->unchecked_value;
        }
        $this->checked = (bool) ($this->value == $this->checked_value);
    }

    public function build()
    {
        $output = "";
        if (parent::build() === false)
            return;

        switch ($this->status) {
            case "disabled":
            case "show":
                if (!isset($this->value)) {
                    $output = $this->layout['null_label'];
                } else {
                    $output = ($this->checked) ? $this->checked_output : $this->unchecked_output;
                }
                $output = "<div class='help-block'>".$output."&nbsp;</div>";
                break;

            case "create":
            case "modify":
                //dd($this->checked);
                $output = Form::checkbox($this->name, $this->checked_value, $this->checked, $this->attributes) . $this->extra_output;
                break;

            case "hidden":
                $output = Form::hidden($this->name, $this->value);
                break;

            default:
        }
        $this->output = $output;
    }

}
