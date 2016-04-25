<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RefererUrlToOriginUrl extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('charts', function ($table) {
            $table->renameColumn('last_referer_url', 'origin_url');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('charts', function ($table) {
            $table->renameColumn('origin_url', 'last_referer_url');
        });
    }
}
