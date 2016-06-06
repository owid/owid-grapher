<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChartSlugRedirectUniqueness extends Migration
{
    public function up()
    {
        Schema::table("chart_slug_redirects", function($table) {
            $table->unique('slug');
        });        
    }
}
