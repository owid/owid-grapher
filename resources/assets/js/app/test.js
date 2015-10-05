'use strict';

var logDate = function() {
  console.log(new Date().getDate());
}

var logMonth = function() {
    console.log(new Date().getMonth());
}

exports.logDate = logDate;