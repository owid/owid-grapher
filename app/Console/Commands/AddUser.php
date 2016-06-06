<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\User;

class AddUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'adduser {name} {email} {password}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Add an owid-grapher user';

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        User::create([
            $this->argument('name'),
            $this->argument('email'),
            Hash::make($this->argument('password'))
        ]);
    }
}
