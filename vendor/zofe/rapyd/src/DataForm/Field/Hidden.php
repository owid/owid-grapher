<?php namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;

class Hidden extends Field
{
  public $type = "hidden";

  public function build()
  {
    $output = "";

    if (parent::build() === false) return;

    switch ($this->status) {
      case "disabled":
      case "show":
        break;

      case "create":
      case "modify":
      case "hidden":
        $output = Form::hidden($this->name, $this->value);
        break;

      default:;
    }
    $this->output = "\n".$output."\n". $this->extra_output."\n";
  }

}
