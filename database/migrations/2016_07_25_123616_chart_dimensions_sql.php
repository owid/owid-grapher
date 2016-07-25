<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;
use App\Variable;

class ChartDimensionsSql extends Migration
{
    public function up() {
        DB::transaction(function() {
            DB::statement("DROP TABLE IF EXISTS chart_dimensions");
            
            $charts = Chart::all();
            $dimensions = [];
            foreach ($charts as $chart) {
                $config = json_decode($chart->config);
                foreach ($config->{"chart-dimensions"} as $dim) {
                    if (!$dim->variableId || !DB::table('variables')->where('id', '=', $dim->variableId)->exists())
                        continue;

                    $row = [
                        'chartId' => $chart->id,
                        'variableId' => $dim->variableId,
                        'property' => $dim->property,
                        'unit' => isset($dim->unit) ? $dim->unit : "",
                        'displayName' => isset($dim->displayName) ? $dim->displayName : "",
                        'targetYear' => isset($dim->targetYear) ? $dim->targetYear : 2000,
                        'tolerance' => isset($dim->tolerance) ? $dim->tolerance : 5,
                        'period' => isset($dim->period) ? $dim->period : "single",
                        'mode' => isset($dim->mode) ? $dim->mode : "latest",
                        'maximumAge' => isset($dim->maximumAge) ? $dim->maximumAge : 5
                    ];
                    $dimensions[]= $row;
                }
            }

            Schema::create('chart_dimensions', function(Blueprint $table) {
                $table->integer('chartId')->unsigned();
                $table->foreign('chartId')->references('id')->on('charts');    
                $table->integer('variableId')->unsigned();
                $table->foreign('variableId')->references('id')->on('variables');
                $table->string('property');
                $table->string('unit')->default("");
                $table->string('displayName')->default("");
                $table->integer('targetYear')->default(2000);
                $table->integer('tolerance')->default(5);
                $table->string('period')->default("single");
                $table->string('mode')->default("latest");
                $table->string('maximumAge')->default(5);
            });

            DB::statement("ALTER TABLE `chart_dimensions` ADD UNIQUE `unique_index` (`chartId`, `variableId`, `property`)");

            DB::table("chart_dimensions")->insert($dimensions);
        });
    }

    public function down() {
        DB::statement("DROP TABLE `chart_dimensions`");
    }
}