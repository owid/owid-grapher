<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class ChartSlugRedirects extends Migration
{
    public function up()
    {
        Schema::create('chart_slug_redirects', function(Blueprint $table) {
            $table->string('slug');
            $table->integer('chart_id')->unsigned();
            $table->foreign('chart_id')->references('id')->on('charts')->onDelete('cascade');
        });
    }
}
