<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class PurgeEmptyCellsFromDatabase extends Migration
{
    public function up()
    {
        DB::statement("DELETE FROM data_values WHERE value='';");                        
    }
}
