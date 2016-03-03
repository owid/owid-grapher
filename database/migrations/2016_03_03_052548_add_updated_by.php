<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddUpdatedBy extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('users', function ($table) {
            $table->unique('name');
        });

        Schema::table('charts', function ($table) {
            $table->string('updated_by')->nullable();
            $table->foreign('updated_by')->references('name')->on('users');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('users', function ($table) {
            $table->dropUnique('name');
        });

        Schema::table('charts', function ($table) {
            $table->dropColumn('updated_by');
        });
    }
}
