<?php
	//https://www.quandl.com/api/v3/datasets/USHOMESEC/REFUGEE_COUNTRY.csv

	$url = 'https://www.quandl.com/api/v3/datasets/USHOMESEC/REFUGEE_COUNTRY.csv';
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	// Set so curl_exec returns the result instead of outputting it.
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	// Get the response and close the channel.
	$response = curl_exec($ch);
	print_r($response);
	curl_close($ch);
?>