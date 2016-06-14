<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class DataValueUniqueness extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        echo("Finding unique data values\n");
        DB::statement("create temporary table unique_values (select t.* from (select * from data_values order by id desc) t group by fk_var_id, fk_ent_id, year)");
        echo("Truncating old table\n");
        DB::statement("truncate table data_values");
        echo("Creating new table\n");
        DB::statement("insert into data_values select * from unique_values");
        echo("Creating uniqueness constraints\n");
        DB::statement("ALTER TABLE `data_values` ADD UNIQUE `unique_index` (`fk_var_id`, `fk_ent_id`, `year`)");
    }
}
