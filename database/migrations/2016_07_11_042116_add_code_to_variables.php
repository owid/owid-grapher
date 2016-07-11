<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddCodeToVariables extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::statement("ALTER TABLE variables ADD COLUMN code VARCHAR(255) DEFAULT NULL");
        DB::statement("CREATE UNIQUE INDEX variables_code_unique ON variables (code, fk_dst_id)");
    }
}
