<?php

/*
|--------------------------------------------------------------------------
| Model Factories
|--------------------------------------------------------------------------
|
| Here you may define all of your model factories. Model factories give
| you a convenient way to create models for testing and seeding your
| database. Just tell the factory how a default model should look.
|
*/

$factory->define(App\User::class, function (Faker\Generator $faker) {
    return [
        'name' => $faker->name,
        'email' => $faker->safeEmail,
        'password' => bcrypt(str_random(10)),
        'remember_token' => str_random(10),
    ];
});

$factory->define(App\DatasetCategory::class, function (Faker\Generator $faker) {
    return [
        'name' => "Category",
    ];
});

$factory->define(App\DatasetSubcategory::class, function (Faker\Generator $faker) {
    return [
        'name' => "Subcategory",
    ];
});

$factory->define(App\Datasource::class, function (Faker\Generator $faker) {
    return [
        'name' => "Source",
        'description' => "Description of source.",
    ];
});

$factory->define(App\Entity::class, function (Faker\Generator $faker) {
    return [
        'name' => $faker->name,
        'code' => $faker->name,
        'validated' => 1,
    ];
});