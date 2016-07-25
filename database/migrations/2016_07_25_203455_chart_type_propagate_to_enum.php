<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Chart;

class ChartTypePropagateToEnum extends Migration
{
    public function up() {
        foreach (Chart::all() as $chart) {
            $config = json_decode($chart->config);
            if (!isset($config->{"chart-type"}))
                continue;
            $type = $config->{"chart-type"};
            if ($type == 1)
                $chart->type = "LineChart";
            else if ($type == 2)
                $chart->type = "ScatterPlot";
            else if ($type == 3)
                $chart->type = "StackedArea";
            else if ($type == 4)
                $chart->type = "MultiBar";
            else if ($type == 5)
                $chart->type = "HorizontalMultiBar";
            else if ($type == 6)
                $chart->type = "DiscreteBar";
            unset($config->{"chart-type"});
            $chart->config = json_encode($config);
            $chart->save();
        }
    }
}
