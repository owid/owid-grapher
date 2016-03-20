<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddVariableDeletionCascade extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            Schema::table('data_values', function ($table) {            
                $table->dropForeign('data_values_fk_var_id_foreign');
                $table->foreign('fk_var_id')
                      ->references('id')
                      ->on('variables')
                      ->onDelete('cascade');

                $table->dropForeign('data_values_fk_time_id_foreign');
                $table->foreign('fk_time_id')
                      ->references('id')
                      ->on('times')
                      ->onDelete('cascade');
            });        
        });
    }

    public function down() {

    }
}
