<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class SvgLogos2 extends Migration
{
    public function up()
    {
        DB::transaction(function() {
            $charts = Chart::all();
            $map = [
                'uploads/26538.png' => 'OWD',
                'uploads/85982.png' => 'BBC',
                'uploads/89437.jpg' => 'DRI',
                'uploads/53823.png' => 'BC',
                'uploads/15068.jpg' => 'CGD',
                'uploads/42798.jpg' => 'GF'
            ];

            foreach ($charts as $chart) {
                $config = json_decode($chart->config);
                $logos = [];

                if (isset($config->logos))
                    continue;

                if (isset($config->{'logo'}) && $config->{'logo'}) {
                    $logos[]= $map[$config->{'logo'}];
                }
                unset($config->{'logo'});

                if (isset($config->{'second-logo'}) && $config->{'second-logo'}) {
                    $logos[]= $map[$config->{'second-logo'}];
                }
                unset($config->{'second-logo'});

                if (count($logos) == 0)
                    $logos[]= 'OWD';

                $config->logos = $logos;

                $chart->config = json_encode($config);
                $chart->save();
            }
        });        
    }
}
