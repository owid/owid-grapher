<?php namespace App\Commands;

use App\Commands\Command;

use Illuminate\Contracts\Bus\SelfHandling;

class TestCommand extends Command implements SelfHandling {

	/**
	 * Create a new command instance.
	 *
	 * @return void
	 */
	public function __construct($id)
	{
		//
		$this->id = $id;
	}

	/**
	 * Execute the command.
	 *
	 * @return void
	 */
	public function handle()
	{
		//
		\Log::info( 'TestCommand handle: ' .$this->id );
	}

}
