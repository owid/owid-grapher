Laravel-GAMP Package
=========================

[![Package for Laravel](https://img.shields.io/badge/Package%20for%20Laravel-4/5-blue.svg?style=flat-square)](https://github.com/irazasyed/laravel-gamp)
[![Latest Version](https://img.shields.io/github/release/irazasyed/laravel-gamp.svg?style=flat-square)](https://github.com/irazasyed/laravel-gamp/releases)
[![Software License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat-square)](LICENSE)
[![SensioLabsInsight](https://insight.sensiolabs.com/projects/880d79a9-7bab-4872-ab98-76b2e53429e9/mini.png)](https://insight.sensiolabs.com/projects/880d79a9-7bab-4872-ab98-76b2e53429e9)
[![Total Downloads](https://img.shields.io/packagist/dt/irazasyed/laravel-gamp.svg?style=flat-square)](https://packagist.org/packages/irazasyed/laravel-gamp)


> Laravel GAMP: Google Analytics Measurement Protocol Package for Laravel 4 & 5.
> Send data to Google Analytics from Laravel. Supports all GA Measurement Protocol API methods.

[![Laravel GAMP](https://cloud.githubusercontent.com/assets/1915268/8476296/b49f74ac-20dd-11e5-8698-aa23b2f7e6fd.png)](https://github.com/irazasyed)


## Quick start


### Required setup / Installation

#### Step 1: Install Through Composer

You can either add the package directly by firing this command

```cli
$ composer require irazasyed/laravel-gamp:~0.5
```

Or add in the `require` key of `composer.json` file manually

```json
"irazasyed/laravel-gamp": "~0.5"
```

And Run the Composer update command

```cli
$ composer update
```

#### Step 2: Add the Service Provider

Open `config/app.php` and, to your "providers" array at the bottom, add:

```php
'Irazasyed\LaravelGAMP\LaravelGAMPServiceProvider'
```

#### Step 3: Add Facade (Optional)

Optionally add an alias to make it easier to use the library. Open `config/app.php` and, to your "aliases" array at the bottom, add:

```php
'GAMP'  => 'Irazasyed\LaravelGAMP\Facades\GAMP'
```

#### Step 4: Publish Config

Open your terminal window and fire the following command to publish config file to your config directory:

#### Laravel 4:
---------------
```cli
$ php artisan config:publish irazasyed/laravel-gamp
```

#### Laravel 5:
---------------

```cli
$ php artisan vendor:publish --provider="Irazasyed\LaravelGAMP\LaravelGAMPServiceProvider"
```

OR

```cli
$ php artisan vendor:publish
```

The former command publishes config file for just this package and the latter publishes vendor files for other packages too. Depending on what you want to do, you can use any (Doesn't really matter).


## Usage

Open `gamp.php` file in `app/config/packages/irazasyed/laravel-gamp` (**Laravel 4**) / `./config` (**Laravel 5**) and set the `tracking_id` with your Google Analytics tracking / web property ID.
Refer the config file for other default configuration settings.

This Package adds Laravel Support to [GA Measurement Protocol][1] PHP Library by [THE ICONIC](https://github.com/theiconic).
It's simply a wrapper around the library with default config for easier usage with Laravel.
So all the methods listed [here][2] are available and will work seamlessly.

### Example Usage

Send a Page view hit:

```php
$gamp = GAMP::setClientId( '123456' );
$gamp->setDocumentPath( '/page' );
$gamp->sendPageview();
```

### Config Overview

Open the config file for detailed comments for each option.

Set your Google Analytics Tracking / Web Property ID in `tracking_id` key **[REQUIRED]**

```php
'tracking_id' => 'UA-XXXX-Y',
```

All other configs are optional, use as per your requirements.

To send data over SSL, set `is_ssl` to true.

```php
'is_ssl' => true,
```

To Anonymize IP, set `anonymize_ip` to true.

```php
'anonymize_ip' => true,
```

To Make Async Requests, set `async_requests` to true.

```php
'async_requests'  => true,
```

...

Refer the library's [documentation][2] for other remaining methods and examples, they all work.

> **Note:** You don't have to use the protocol version, tracking id, anonymize ip and async request (non-blocking) methods from the original library as they're automatically set in Service Provider when the package is initialized based on the config file. As long as you update the config file with correct settings, it should work just fine.

## Additional information

Any issues, please [report here](https://github.com/irazasyed/laravel-gamp/issues)

## Credits

This package is a wrapper around the GA Measurement Protocol PHP Library. Thanks to the guys @ [THE ICONIC][1] who developed the library!

[1]: https://github.com/theiconic/php-ga-measurement-protocol
[2]: https://github.com/theiconic/php-ga-measurement-protocol#usage

## License

[MIT](LICENSE) © [Syed Irfaq R.](https://github.com/irazasyed)
