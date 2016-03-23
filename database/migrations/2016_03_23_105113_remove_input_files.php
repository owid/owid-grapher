<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RemoveInputFiles extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('data_values', function($table) {
            $table->dropForeign('data_values_fk_input_files_id_foreign');
            $table->dropColumn('fk_input_files_id');
        });
    }
}
