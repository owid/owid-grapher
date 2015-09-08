<?php

namespace Zofe\Rapyd\DataForm\Field;

use Illuminate\Html\FormFacade as Form;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Input;

class Map extends Field
{

    public $type = "map";

    public function autoUpdate($save = false)
    {

        $this->getValue();

        if ((($this->action == "update") || ($this->action == "insert"))) {

            if (Input::hasFile($this->name)) {
                $this->file = Input::file($this->name);

                $filename = ($this->filename!='') ?  $this->filename : $this->file->getClientOriginalName();

                //se il nuovo file è diverso,  dovrei cancellare il vecchio


                $uploaded = $this->file->move($this->path, $filename);
                $this->saved = $this->path. $filename;

                if ($uploaded && is_object($this->model) && isset($this->db_name)) {

                    if (!Schema::hasColumn($this->model->getTable(), $this->db_name)) {
                         return true;
                    }

                    $this->new_value = $filename;

                    if (isset($this->new_value)) {
                        $this->model->setAttribute($this->db_name, $this->new_value);
                    } else {
                        $this->model->setAttribute($this->db_name, $this->value);
                    }
                    if ($save) {
                        return $this->model->save();
                    }
                }

            }
        }

        return true;
    }

    public function build()
    {
        $output = "";
        $this->attributes["class"] = "form-control";
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
                    //immagine statica della mappa su lat e lon  su api google
                    $output = nl2br(htmlspecialchars($this->value));
                }
                $output = "<div class='help-block'>" . $output . "</div>";
                break;

            case "create":
            case "modify":
                $output  = Form::text($this->lat, $this->attributes);
                $output .= Form::text($this->lon, $this->attributes);

//            <input type="text" id="latitude" placeholder="latitude">
//  <input type="text" id="longitude" placeholder="longitude">
//  <div id="map" style="width:500px; height:500px"></div>

//  <script src="https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false"></script>
  <script>
    function initialize()
    {
        var $latitude = document.getElementById('latitude');
        var $longitude = document.getElementById('longitude');
        var latitude = 50.715591133433854
        var longitude = -3.53485107421875;
        var zoom = 7;

        var LatLng = new google.maps.LatLng(latitude, longitude);

        var mapOptions = {
            zoom: zoom,
            center: LatLng,
            panControl: false,
            zoomControl: false,
            scaleControl: true,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        }

        var map = new google.maps.Map(document.getElementById('map'),mapOptions);

        var marker = new google.maps.Marker({
            position: LatLng,
            map: map,
            title: 'Drag Me!',
            draggable: true
        });

        google.maps.event.addListener(marker, 'dragend', function (marker) {
            var latLng = marker.latLng;
            $latitude.value = latLng.lat();
            $longitude.value = latLng.lng();
        });

    }
    initialize();
    </script>


                break;

            case "hidden":
                $output = Form::hidden($this->db_name, $this->value);
                break;

            default:;
        }
        $this->output = "\n" . $output . "\n" . $this->extra_output . "\n";
    }

}
