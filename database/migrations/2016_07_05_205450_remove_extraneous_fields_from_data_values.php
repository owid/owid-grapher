<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RemoveExtraneousFieldsFromDataValues extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE data_values DROP FOREIGN KEY data_values_fk_dsr_id_foreign");        
        DB::statement("ALTER TABLE data_values DROP COLUMN fk_dsr_id");
        DB::statement("ALTER TABLE data_values DROP COLUMN description");
        DB::statement("ALTER TABLE data_values DROP COLUMN created_at");
        DB::statement("ALTER TABLE data_values DROP COLUMN updated_at");
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
}
