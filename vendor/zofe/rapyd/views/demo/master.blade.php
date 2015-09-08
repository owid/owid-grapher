<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Rapyd crud widgets for laravel 4')</title>
    <meta name="description" content="@yield('description', 'crud widgets for laravel 4. datatable, grids, forms, in a simple package')" />
    @section('meta', '')

    <link href="http://fonts.googleapis.com/css?family=Bitter" rel="stylesheet" type="text/css" />
    <link href="//netdna.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css" rel="stylesheet">
    <link href="//maxcdn.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet">
    
    {!! Rapyd::styles(true) !!}
</head>

<body>

<div id="wrap">

    <div class="container">

        <br />

        <div class="row">


            <div class="col-sm-12">
                @yield('content')
            </div>


        </div>


    </div>



</div>

<div id="footer">
</div>
<script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>
<script src="//netdna.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>
{!! Rapyd::scripts() !!}
</body>
</html>
