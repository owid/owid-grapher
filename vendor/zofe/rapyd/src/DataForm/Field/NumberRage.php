<?php

namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;
use Zofe\Rapyd\Rapyd;

class Numberrange extends Number
{
    public $type = "numberrange";
    public $multiple = true;
    public $clause = "wherebetween";

    public function getValue()
    {
        parent::getValue();
        $this->values = explode($this->serialization_sep, $this->value);
    }

    public function build()
    {
        $output = "";

        if (parent::build() === false) {
            return;
        }

        switch ($this->status) {
            case "disabled":
            case "show":

                if ($this->type == 'hidden' || $this->value == "") {
                    $output = "";
                } elseif ((!isset($this->value))) {
                    $output = $this->layout['null_label'];
                } else {
                    $output = $this->value;
                }
                $output = "<div class='help-block'>" . $output . "&nbsp;</div>";
                break;

            case "create":
            case "modify":

                $lower = Form::number($this->name . '[]', @$this->values[0], $this->attributes);
                $upper = Form::number($this->name . '[]', @$this->values[1], $this->attributes);

                $output = '
                            <div id="range_' . $this->name . '_container">
                                   <div class="input-group">
                                       <div class="input-group-addon">&ge;</div>
                                       ' . $lower . '
                                   </div>
                                   <div class="input-group">
                                        <div class="input-group-addon">&le;</div>
                                        ' . $upper . '
                                   </div>
                            </div>';
                break;

            case "hidden":
                $output = Form::hidden($this->name, $this->value);
                break;

            default:
        }
        $this->output = "\n" . $output . "\n" . $this->extra_output . "\n";
    }

}
