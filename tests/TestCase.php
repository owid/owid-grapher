<?php

use Illuminate\Foundation\Testing\DatabaseTransactions;

class TestCase extends Illuminate\Foundation\Testing\TestCase
{
    use DatabaseTransactions;

    public static $isReady = false;

    // Set up the database only once per test run
    public static function prepareForTests() {
        if (self::$isReady) return;

        $database = Config::get('database.connections.'.Config::get('database.default').'.database');
        $username = Config::get('database.connections.'.Config::get('database.default').'.username');
        $password = Config::get('database.connections.'.Config::get('database.default').'.password');
        exec("mysql -D {$database} -u {$username} --password={$password} < database/schema.sql");

        self::$isReady = true;
    }

    public function setUp() {
        parent::setUp();

        self::prepareForTests();
    }

    /**
     * The base URL to use while testing the application.
     *
     * @var string
     */
    protected $baseUrl = 'http://localhost';

    /**
     * Creates the application.
     *
     * @return \Illuminate\Foundation\Application
     */
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        return $app;
    }



}
