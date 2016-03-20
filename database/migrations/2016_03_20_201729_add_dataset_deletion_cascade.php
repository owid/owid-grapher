<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddDatasetDeletionCascade extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */    
    public function up()
    {
        DB::transaction(function() {
            Schema::table('variables', function ($table) {
                $table->dropForeign('variables_fk_dst_id_foreign');
                $table->foreign('fk_dst_id')
                      ->references('id')
                      ->on('datasets')
                      ->onDelete('cascade');
            });        

            Schema::table('link_datasets_tags', function ($table) {
                $table->dropForeign('link_datasets_tags_fk_dst_id_foreign');
                $table->foreign('fk_dst_id')
                      ->references('id')
                      ->on('datasets')
                      ->onDelete('cascade');
            });        
        });
    }

    public function down() {
        
    }
}
