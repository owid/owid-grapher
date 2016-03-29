<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddEstebanEntities extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        DB::transaction(function() {
            $names = ['Channel Islands', 'Melanesia', 'Polynesia', 'Caribbean Netherlands', 'Northern Cyprus', 'Turkish Republic of Northern Cyprus', 'North Cyprus'];
            foreach ($names as $name) {
                DB::statement("INSERT INTO entities (name, validated, fk_ent_t_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE validated=1;", [$name, 1, 5]);                
            }
        });
    }
}
