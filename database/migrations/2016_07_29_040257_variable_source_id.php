<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class VariableSourceId extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE variables DROP FOREIGN KEY variables_fk_dsr_id_foreign");
        DB::statement("ALTER TABLE variables CHANGE fk_dsr_id sourceId INT UNSIGNED NOT NULL");
        DB::statement("DELETE FROM variables WHERE sourceId=0;");
        DB::statement("ALTER TABLE variables ADD CONSTRAINT variables_sourceId_foreign FOREIGN KEY (sourceId) REFERENCES sources(id)");        
    }

    public function down() { }
}
