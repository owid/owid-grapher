<?php

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateInvitationUserTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('user_invitations', function (Blueprint $table) {
            $table->BigIncrements('id');
            $table->string('code')->index();
            $table->string('email');
            $table->BigInteger('user_id')->unsigned();
            $table->enum('status', ['pending', 'successful','canceled','expired']);
            $table->datetime('valid_till');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::drop('user_invitations');
    }
}
