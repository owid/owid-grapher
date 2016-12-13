<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class NullableTargetYear extends Migration
{
    public function up()
    {
        DB::transaction(function() {
            DB::statement("ALTER TABLE chart_dimensions MODIFY targetYear INTEGER NULL");
            DB::statement("UPDATE chart_dimensions SET targetYear=NULL WHERE targetYear=0");
        });
    }
}
