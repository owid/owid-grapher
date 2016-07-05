<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class RemoveEntityType extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE entities DROP FOREIGN KEY entities_fk_ent_t_id_foreign");
        DB::statement("ALTER TABLE entities DROP COLUMN fk_ent_t_id");
        DB::statement("DROP TABLE entity_types");
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
