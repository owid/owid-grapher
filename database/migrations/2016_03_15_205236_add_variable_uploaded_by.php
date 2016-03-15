<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use App\Variable;

class AddVariableUploadedBy extends Migration
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
                $table->string('uploaded_by')->nullable();
                $table->foreign('uploaded_by')->references('name')->on('users');
                $table->timestamp('uploaded_at');
            });

            foreach (Variable::all() as $var) {
                $var->uploaded_at = $var->created_at;
                $var->save();
            }
        });
    }
}
