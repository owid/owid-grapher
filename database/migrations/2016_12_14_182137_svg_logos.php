<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class SvgLogos extends Migration
{
    public function up()
    {
        DB::statement("ALTER TABLE logos DROP COLUMN url");
        DB::statement("ALTER TABLE logos ADD COLUMN svg TEXT NOT NULL DEFAULT \"\"");
    }
}
