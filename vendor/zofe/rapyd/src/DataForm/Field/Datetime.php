<?php

namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;
use Zofe\Rapyd\Rapyd;

class Datetime extends Field
{
    public $type = "datetime";
    public $format = 'm/d/Y H:i';
    public $language = 'en';

    /**
     * set instarnal preview datetime format
     * @param $format valid php datetime format
     * @param string $language valid datetimePicker language string http://www.malot.fr/bootstrap-datetimepicker/
     */
    public function format($format, $language = 'en')
    {
        $this->format = $format;
        $this->language = $language;

        return $this;
    }

    /**
     * convert from iso datetime to user format
     */
    protected function isodatetimeToHuman($isodatetime)
    {
        $datetime = \dateTime::createFromFormat( 'Y-m-d H:i', $isodatetime);
        if (!$datetime) return '';
        $timestamp = $datetime->getTimestamp();
        if ($timestamp < 1) {
            return "";
        }
        $isodate = date($this->format, $timestamp);

        return $isodatetime;
    }

    /**
     * convert from current user format to iso datetime
     */
    protected function humandatetimeToIso($humandatetime)
    {
        $datetime = \dateTime::createFromFormat( $this->format, $humandatetime);
        if (!$datetime) return '';
        $timestamp = $datetime->getTimestamp();
        if ($timestamp < 1) {
            return "";
        }
        $humandatetime = date('Y-m-d H:i', $timestamp);

        return $humandatetime;
    }

    /**
     * overwrite new value to store a iso datetime
     */
    public function getNewValue()
    {
        parent::getNewValue();
        $this->new_value = $this->humandatetimeToIso($this->new_value);
    }

    /**
     * simple translation from php datetime format to datetimePicker format
     * basic translation of numeric timestamps m/d/Y H:i:s, d/m/Y g:i:s, ...
     * @param $format valid php datetime format http://www.php.net/manual/it/function.date.php
     * @return string valid datetimepicker format http://www.malot.fr/bootstrap-datetimepicker/
     */
    protected function formatTodatetime()
    {
        $format = $this->format;
        $format = str_replace(array('d',  'm',  'Y', 'H', 'i', 's', 'a', 'A', 'g', 'G'),
                              array('dd', 'mm', 'yyyy', 'hh', 'ii', 'ss', 'p', 'P', 'H', 'h'),
                             $format
        );

        return $format;
    }

    public function build()
    {
        $output = "";

        unset($this->attributes['type']);
        if (parent::build() === false) return;

        switch ($this->status) {

            case "show":
                if (!isset($this->value)) {
                    $value = $this->layout['null_label'];
                } else {
                    $value = $this->isodatetimeToHuman($this->value);
                }
                $output = $value;
                $output = "<div class='help-block'>".$output."&nbsp;</div>";
                break;

            case "create":
            case "modify":
                if ($this->value != "") {
                    if (!$this->is_refill) {
                        $this->value = $this->isodatetimeToHuman($this->value);
                    }
                }

                Rapyd::css('datetimepicker/datetimepicker3.css');
                Rapyd::js('datetimepicker/bootstrap-datetimepicker.js');
                if ($this->language != "en") {
                    Rapyd::js('datetimepicker/locales/bootstrap-datetimepicker.'.$this->language.'.js');
                }

                $output  = Form::text($this->name, $this->value,  $this->attributes);
                Rapyd::script("
                        $('#".$this->name."').datetimepicker({
                            format: '{$this->formatTodatetime()}',
                            language: '{$this->language}',
                            todayBtn: 'linked',
                            autoclose: true
                        });");

                break;
            case "hidden":
                $output = Form::hidden($this->db_name, $this->value);
                break;
            default:;
        }
        $this->output = $output;
    }

}
