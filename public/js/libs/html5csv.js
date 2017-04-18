// html5csv.js (C) Copyright 2013 Dr Paul Brewer
// This Javscript library is Free software and comes with ABSOLUTELY NO WARRANTY
//
// The author hereby provides permission to use this free software under the terms 
// of the GNU General Public License which may be found at 
// http://www.gnu.org/licenses/gpl-3.0.txt
//
// Some organizations prefer not to be bound by the terms of the GNU General Public License.
//
// Commercial licenses from the author are available, and may provide for uses not permitted
// under the GNU General Public License. The author may be contacted on Linked In 
// via http://www.linkedin.com/in/drpaulbrewer
//
// Uses requiring a commercial license include serving or distributing an object code version 
// of this software, without also supplying the fully readable, editable source code, 
// (where object code includes any minified, compiled, compressed or obfuscated 
// Javascript code that uses shortened names or space removal and is therefore no longer in 
// the preferred form for editing by software developers), combining the software here in the
// same Javascript file with other proprietary software that is not provided as 
// free software under terms similar to the GNU General Public License, embedding the 
// software into a hardware device so that it can not be viewed or edited by the end user, 
// or modifying or removing these notices and/or copyright notices in ways contrary 
// to the free license.  This may not be the entire list of uses requiring a commercial license.
//
//
"use strict";

if (typeof window.jQuery === 'undefined'){
    console.log("CSV: jQuery is not loaded.  Load jquery before loading csv.js");
    throw "CSV: jQuery is not loaded";
}

window.CSV = (function(){

    var csvFuncs = {
	'push': push,
	'call': call,
	'hslice': hslice,
	'table': table,
	'editor': editor,
	'jqplot': jqplot,
	'appendCol': appendCol,
	'ols': ols,
	'save': save,
	'download': download,
	'pca': pca
    };

    var csvShared = { 
	taskDelay: 50,
	specialNames:{
	    '%U': ['uniformRandomMatrix','dim'],
	    '%N': ['normalRandomMatrix','dim'],
	    '%I': ['identityMatrix', 'dim'],
	    '%D': ['diagonalMatrix', 'diag'],
	    '%F': ['forij', 'dim', 'func']
	},
	finalCallback: function(e,data){ 
		if (e) { console.log(e) }
	},
	fill: function(dim, x){
	    var il=dim[0],jl=dim[1];
	    var i,j;
	    var row = [], rows=[];
	    for(j=0;j<jl;++j) row[j] = x;
	    for(i=0;i<il;++i) rows.push(row.slice(0));
	    return rows;
	},	
	forij: function(dim,func){
	    var ilen=dim[0],jlen=dim[1];
	    var i,j;
	    var result=[];
	    for(i=0;i<ilen;++i) result.push([]);
	    for(i=0;i<ilen;++i)
		for(j=0;j<jlen;++j)
		    result[i][j] = func(i,j);
	    return result;
	},
	uniformRandomMatrix: function(dim){
	    var r=dim[0],c=dim[1];
	    var i,j;
	    var D = [], row;
	    for(i=0;i<r;++i){
		D[i] = [];
		row = D[i];
		for(j=0;j<c;++j) row[j] = Math.random();
	    }
	    return D;
	},
	normalRandomMatrix: function(dim){
	    // return a matrix full of indep random normals, mean 0, var 1
	    // using Box-Muller Transform of uniforms -- see wikipedia
	    // http://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
	    function boxMullerMethod(q){
		var n = 1+Math.floor(q/2);
		var rand = [];
		var i;
		var u,v,r,a;
		for(i=0;i<n;++i){
		    u = Math.random();
		    v = Math.random();
		    r = Math.sqrt(-2*Math.log(u));
		    a = 2*Math.PI*v;
		    rand.push(r*Math.cos(a));
		    rand.push(r*Math.sin(a));
		}
		return rand;
	    }
	    var norms = boxMullerMethod(dim[0]*dim[1]);
	    var D=[],i,j,li=dim[0],lj=dim[1];
	    for(i=0;i<li;++i){
		D[i] = [];
		for(j=0;j<lj;++j)
		    D[i][j] = norms.shift();
	    }
	    return D;
	},	    
	identityMatrix: function(dim){
	    var r=dim[0],c=dim[1];
	    var D = this.fill(dim,0);
	    var i,l=Math.min(r,c);
	    for(i=0;i<l;++i) D[i][i] = 1;
	    return D;
	},
	diagonalMatrix: function(diag){
	    var D = this.fill([diag.length,diag.length],0);
	    var i,l=diag.length;
	    for(i=0;i<l;++i) D[i][i]=diag[i];
	    return D;
	},
	submatrix: function(r, c){
	    var shared = this;
	    var rownums,cols,colnums;
	    var i,l,j,k;
	    var M = [];
	    if ((!shared.data) || 
		(!shared.data.rows) || 
		(!shared.data.rows.length) ) throw "CSV: shared.submatrix invalid shared.data.rows.length";
	    var header = shared.data.rows[0];
	    var rows = shared.data.rows;
	    var row = [];
	    rownums = r || [1,shared.data.rows.length];
	    if (!rownums[0]) rownums[0]=1;
	    if (!rownums[1]) rownums[1]=shared.data.rows.length;
	    cols = c || [shared.data.rows[0].slice(0)];
	    colnums = [];
	    if ( (!cols) || (!cols.length) ) throw "CSV: shared.submatrix invalid cols.length";
	    for(i=0,l=cols.length;i<l;++i){
		colnums.push(
	         ((typeof cols[i] === 'string')? header.indexOf(cols[i]) : -1)
		);
	    }
	    k = colnums.length;
	    if (!k) throw "CSV: shared.submatrix invalid colnums.length";
	    for(i=rownums[0],l=rownums[1];i<l;++i){
		row = [];
		for(j=0;j<k;++j){
		    if (colnums[j]>=0){
			row.push(rows[i][colnums[j]]);
		    } else if (typeof cols[j] === 'number'){
			row.push(cols[j]);
		    } else if (typeof cols[j] === 'function'){
			row.push((cols[j])(i,j,rows[i]));
		    } else row.push(null);
		}
		M.push(row);
	    }
	    return M;
	},
	numberize: function(rows){
	    var i,j,k,l,v,f;
	    for(i=0,l=rows.length;i<l;++i){
		for(j=0,k=rows[i].length;j<k;++j){
		    v = rows[i][j];
		    // see isnumeric discussion in http://stackoverflow.com/a/1830844/103081 
		    if (typeof v === 'string'){
			f = parseFloat(v);
			if (!isNaN(f) && isFinite(v)) rows[i][j] = f;
		    }
		}
	    }
	    return rows;
	},
	easyParseCSV: function(t, comma, newline){ 
	    // handles unquoted CSV parsing
	    var lines=t.split(newline), all = [];
	    var i,l;
	    for(i=0, l=lines.length; i<l; ++i)
		all[i]=lines[i].split(comma);
	    return all;
	},
	hardParseCSV: function(t, quote, comma, newline, pretrim){
	    var i, c, field, row, all, q;
	    // goal: parse according to RFC4180
	    all = [];
	    row = [];
	    field = '';
	    q = false;
	    i = 0;
	    while (i < t.length ){ 
		c = t.charAt(i);
		if (c === quote){ 
		    if (field.length === 0){ 
			q = !q;
		    } else if ( (t.length>(i+1)) 
				&& (t.charAt(i+1) === quote)
			      ){ 
			++i;
			field += quote;
		    } else if (q){ 
			q = false;
		    } else {
			// if there is a quote here, it is not RFC4180
			// field += quote;  we could include it anyway... or not
		    }
		} else if (c === comma){ 
		    if (q){ 
			field += comma;
		    } else {
			row.push(field);
			field = '';
		    }
		} else if (c === newline){ 
		    if (q){
			field += newline;
		    } else {
			if (field.length > 0){
			    row.push(field);
			    field = '';
			}
			all.push(row);
			row = [];
		    }
		} else if ((c === pretrim) && (field.length === 0)){
		} else {
		    field += c;
		}
		++i;
	    }
	    if (field.length>0) row.push(field);
	    if (row.length>0) all.push(row);
	    return all;
	},
	parseCSV: function(t){
	    var shared = this;
	    // if there are no quotes, this will just split on newline and comma
	    // if there are quotes, then it has to be done one char at a time
	    var newline="\n", quote='"', comma = ",", space=" ";
	    var all; 
	    if (t.indexOf(quote) === -1){
		all = shared.easyParseCSV(t, comma, newline);
	    } else {
		all = shared.hardParseCSV(t, quote, comma, newline, space);
	    }
	    return shared.numberize(all);
	},
	fromFile: function(id){
	    var shared = this;
	    if (!shared.data.rows) shared.data.rows = [];
	    var armed = true;
	    var f, reader;
	    var fileSuccess = function(evt){
		try {
		    shared.data.rows = shared.parseCSV(evt.target.result);
		} catch(e){
		    shared.finalCallback("CSV: shared.fromFile fileSuccess handler error: "+e);
		}
		shared.nextTask();
	    };
	    var fileError = function(e){
		throw "CSV.shared: fetch from file error: "+e;
	    };
	    var fileChange = function(evt){
		if(armed){ 
		    armed = false;
		    if (evt.target &&
			evt.target.files &&
			evt.target.files[0]
		       ){ f = evt.target.files[0];
			  reader = new FileReader();
			  reader.onerror = fileError;
			  reader.onload = fileSuccess;
			  reader.readAsText(f);
			} else {
			    throw "CSV shared.fromFile fileChange expected evt.target.files";
			}
		}
		$(id).off('change', fileChange);
		$(id).prop('disabled',true);
	    };
	    $(id+'[type="file"]').on('change', fileChange);
	},
	fromTable: function(id){
	    return $(id+' tr').map(function(i) {
		var row = [];
		var item;
		$(this).find('th,td').each(function(i) {
		    item = $(this).text();
                    // fix for issue #1 
                    item = $.trim(item);  // use jQuery's trim to kill newlines, whitesp
                    // end fix
		    if (isNaN(item)){
			if (item==='null') item=null;
			if (item==='undefined') item=undefined;
		    } else if (item === ''){
			item = '';
		    } else item = 1 * item;
		    row[i] = item;
		});
		return [row]; // inside another array to defeat flattening
	    }).get();
	},
	col: function(X,j){ 
	    var i,l,d=[];
	    for(i=0,l=X.length;i<l;++i) d.push(X[i][j]);
	    return d;
	},
	colAvg: function(X){ 
	    var i,l,j,k,s=[];
	    for(i=0,l=X[0].length; i<l; ++i) s[i]=0;
	    for(i=0,l=X.length;i<l;++i)
		for(j=0,k=s.length;j<k;++j)
		    s[j]+=X[i][j]/l;
	    return s;
	},
	colAvg2: function(X){
	    var i,l,j,k,v,s=[];
	    for(i=0,l=X[0].length; i<l; ++i) s[i]=0;
	    for(i=0,l=X.length;i<l;++i)
		for(j=0,k=s.length;j<k;++j){
		    v = X[i][j];
		    s[j]+=(v*v)/l;
		}
	    return s;
	},
	colVar: function(X, ssc, zeromean){
	    // ssc is boolean option for small sample correction
	    // zeromean is boolean option to ignore sample mean as if 0.0
	    var meanOfSquare = this.colAvg2(X);
	    var mean = this.colAvg(X);
	    var scale = (ssc)?(X.length/(X.length-1)): 1;
	    var i,l,squareOfMean=[], result=[];
	    for(i=0,l=X[0].length; i<l; ++i){
		squareOfMean[i] = (zeromean)? 0: (mean[i]*mean[i]);
		result[i] = scale * (meanOfSquare[i] - squareOfMean[i]);
	    }
	    return result
	},
	nextTask: function (jqXHR, textStatus){
	    var shared = this;
	    var task;
	    if  (textStatus && textStatus!=="success"){ 
		return shared.finalCallback("CSV: ajax error: "+textStatus);
	    }
	    if ((typeof shared.todo === 'object') && (shared.todo.length > 0)){
		task = shared.todo.shift();
		return setTimeout(
		    function(){
			var func = task.f;
			if (typeof func !== 'function')
			    func = csvFuncs[task.f];
			if (typeof func !== 'function')
			    throw "CSV: shared.nextTask encountered unknown task in to do list";
			try {
			    return func.apply(shared,task.a)
			} catch(e) {
			    shared.todo = 'in error finalCallback'; 
			    shared.finalCallback(e, null);
			    shared.todo = 0;
			    return;
			}
		    }, 
		    shared.taskDelay);
	    } 
	    // task list empty
	    if ((typeof shared.todo === 'object') && (shared.todo.length===0)){
		shared.todo  = 'in finalCallback'; // now actions is no longer object
		shared.finalCallback(null, shared.data);  
		shared.todo = 0;  // when 0 will allow finalize to rearm 
		// call finalCallback first in order to give simple
		// callbacks a chance to finish before finalize()() could restart
		return;
	    }
	    throw "somehow called nextTask after finalCallback executed";
	}
    };

    var CSVRETURN = {
	'begin': begin,
	'extend': extend,
    };

    function extend(newCsvFuncs, newCsvShared){
	if (typeof newCsvFuncs === "object"){ 
	    $.extend(csvFuncs, newCsvFuncs);
	} else { 
	    throw "CSV: extend newCsvFuncs must be either an object with function values to extend csvFuncs or null for no extensions";
	}
	if (typeof newCsvShared === "object"){
	    $.extend(csvShared, newCsvShared);
	} else if (typeof newCsvShared === "undefined"){
	    // do nothing
	} else 
	    throw "CSV: extend newCsvShared must be either an object with functions and other values to extend newCsvShared or null/undefined for no extensions";
	return CSVRETURN;
    }
	    
    function planner(cando, candone, todo){
	var methods = {};
	var i,l;
	function plan(F){
	    return function(){
		todo.push({
		    f:F, 
		    a: Array.prototype.slice.call(arguments)
		});
		return methods;
	    }
	}
	for(i=0,l=cando.length;i<l;++i) 
	    methods[cando[i]] = plan(cando[i]);
	for(i=0,l=candone.length;i<l;++i) 
	    methods[candone[2*i]] = candone[2*i+1];
	return methods;
    }

    function makeTable(rows, opt){
	var buf=[];
	if (!rows || !rows.length) throw "CSV: makeTable no rows or rows invalid";
	var i=0,l=rows.length, row=[];
	var j,k;
	function t(n, options, args){
	    var i,o;
	    if (typeof options === 'object'){
		o = options;
	    } else if (typeof options === 'function'){
		o = options.apply({}, args);
	    } else {
		o = {};
	    }
	    buf.push('<',n);
	    for (i in o){
		if (o.hasOwnProperty(i)) buf.push(' ',i,'="',o[i],'" ');
	    }
	    buf.push('>');
	}
	t('table', opt.table);
	if (opt.caption){ 
	    t('caption', opt.captionOpt);
	    buf.push(opt.caption);
	    buf.push('</caption>');
	}
	i = 0;
	if (opt.header || opt.thead){
	    row=rows[0];
	    t('thead', opt.thead);
	    t('tr', opt.theadtr, [0]);
	    for(j=0,k=row.length; j<k; ++j) { 
		t('th', opt.th, [i,j,row[j]]);
		buf.push(row[j], '</th>');
	    }
	    buf.push('</tr></thead>');
	    i = 1;
	}
	t('tbody', opt.tbody);
	for(;i<l;++i){
	    t('tr', opt.tr, [i]);
	    row=rows[i];
	    for(j=0,k=row.length; j<k; ++j){
		t('td', opt.td, [i,j,row[j]]);
		if ((opt.cell) && (typeof opt.cell === 'function')){ 
		    buf.push(opt.cell(i,j,row[j]));
		} else buf.push(row[j]); 
		buf.push('</td>');
	    }
	    buf.push('</tr>');	    
	}
	buf.push('</tbody></table>');
	return buf.join('');
    }


    function localFetch(csvname){
	var splitname = csvname.split('/');
	var D,J;
	if ((splitname[0]!=='local') &&
	    (splitname[0]!=='session')
	   ) throw "localFetch must be from local/ or session/, got: "+csvname;
	J = window[splitname[0]+'Storage'].getItem(csvname);
	if ((J === null) || (typeof J === 'undefined')) throw 'CSV: '+csvname+' not found';
	if ((window.LZString) && 
	    (typeof window.LZString.decompressFromUTF16 === 'function')){
	    D = JSON.parse(LZString.decompressFromUTF16(J));
	} else {
	    D = JSON.parse(J);
	}
	return D;
    }

    function localCreate(csvname, rows, meta){
	var csvObject, J;
	var splitname = csvname.split('/');
	if ((splitname[0]!=='local') &&
	    (splitname[0]!=='session')
	   ) throw "localCreate must save to local/ or session/, got: "+csvname;
	csvObject = {'name': csvname,
		     'rows': rows,
		     'createDate': (''+new Date())
		    };
	if (meta) csvObject.meta = meta;
	if ((window.LZString) && 
	    (typeof window.LZString.compressToUTF16 === 'function')){ 
	    J = LZString.compressToUTF16(JSON.stringify(csvObject));
	} else {
	    J = JSON.stringify(csvObject);
	}
	window[splitname[0]+'Storage'].setItem(csvname, J);
	// dont call nextTask() here , localFetch() will do that
    }

    function fetch(){
	var shared = this;
	var doNextTask = true;
	if (!shared.data) shared.data = {};
	if (!shared.data.meta) shared.data.meta = {};
	try {
	    if (shared.init.options.meta){
		$.extend(shared.data.meta, 
			 shared.init.options.meta);
	    }
	} catch(e){}; // do nothing if the fields do not exist
	var parseAjaxReply = function(ajaxData){
	    shared.data = ( 
		(typeof ajaxData === 'text') &&
		    (shared.init.options.parseCSV) 
	    ) ? {rows: shared.parseCSV(ajaxData), meta:{}} : shared.init.options.extractData(ajaxData);
	    shared.nextTask();
	}	
	if (shared.isLocal){
	    shared.data = localFetch(shared.init.csvName);
	} else if (shared.init.data){
	    shared.data.rows = shared.init.data;
	} else if (shared.init.csvString){
	    shared.data = shared.parseCSV(shared.init.csvString);
	    delete shared.init.csvString;
	} else if (shared.init.getURL){
	    return $.get(
		shared.init.getURL,
		'',
		parseAjaxReply
	    );
	} else if (shared.init.specialName){
	    (function(){
		var special = shared.init.specialName;
		var dict = shared.specialNames[special];
		var func = shared[dict[0]];
		var i,l;
		var actualArgs=[];
		for(i=1,l=dict.length;i<l;++i){
		    if (typeof shared.init.options[dict[i]] === 'undefined'){
			console.log("warning for specialName = "+special);
			console.log("parameter "+dict[i]+" is undefined");
		    }
		    if (shared.init.options[dict[i]] === null){
			console.log("warning for specialName = "+special);
			console.log("parameter "+dict[i]+" is null");
		    }
		    actualArgs.push(shared.init.options[dict[i]]);
		}
		shared.data.rows = func.apply(shared, actualArgs);
	    })();
	} else if (shared.init.csvName){
	    return shared.ajaxMapper.apply(shared,['fetch',shared.init.csvName]);
	} else if (shared.init.jqName){
	    if ($(shared.init.jqName).attr('type')==='file'){
		shared.fromFile.apply(shared,[shared.init.jqName]);
		doNextTask = false;
	    } else {
		shared.data.rows = shared.fromTable(shared.init.jqName);
		if (!shared.data.rows.length){
		    throw "CSV: fetch no data found in table rows following "+shared.init.jqName;
		}
	    }
	} else if (shared.init.fetcher){
	    shared.data = shared.init.fetcher();
	} else if (shared.init.ajax){
	    shared.init.ajax.success = parseAjaxReply;
	    return $.ajax(shared.init.ajax);
	} else if (typeof shared.init.fill === 'number'){
	    shared.data.rows = shared.fill(shared.init.options.dim,
					   shared.init.fill);
	} else throw "CSV: fetch unknown csv data source";
	if ((shared.init) && (shared.init.options) && (shared.init.options.header)){
	    if (shared.init.options.header.length === shared.data.rows[0].length){
		shared.data.rows.unshift(shared.init.options.header);
	    } else {
		throw "CSV: fetch: option header: length mismatches data";
	    }
	}
	if (doNextTask) shared.nextTask();
    }
		   

    function push(){
	var shared = this;
	var newrows = Array.prototype.slice.call(arguments);
	if ((newrows.length>0) && 
	    (newrows[0].length>0) && 
	    shared.data && 
	    shared.data.rows){ 
	    Array.prototype.push.apply(shared.data.rows, newrows);
	    if (isLocalCSV){
		localCreate(shared.data.rows, shared.data.meta);
	    } else {
		shared.ajaxMapper('push',shared.init.csvName, newrows);
	    }
	} 
    }


    function call(){
	var shared = this;
	var remainingActions = shared.todo.length;
	var args = Array.prototype.slice.call(arguments);
	var func = args.shift();
	var flag = func.apply(shared, args);
	// allow for safely automatically calling nextTask()
	// also allow experts to explicitly call nextTask()
	// and  allow experts to explicitly stop or defer
	if (typeof flag === 'undefined'){
	    if (shared.todo.length === remainingActions){
		return shared.nextTask();
	    }
	} else if ( (flag ==='stop') || (flag === 'defer') ) { 
	    return 0; 
	} else {
	    // any other return is an error
	    throw 'CSV: call() user function returned something other than "stop" or "defer"';
	}
    }

    function hslice(arg1,arg2){
	var shared = this;
	var header = shared.data.rows[0].slice(0), copy=[], include=false;
	var data = shared.data;
	var row = [];
	var tests = [];
	var t = null;
	var i,l,j,k;
	if (typeof arg1 === 'number'){ 
	    data.rows = data.rows.slice(arg1,arg2);
	    data.rows.unshift(header);
	    return shared.nextTask();
	}
	if ((typeof arg1 === 'object') && (arg1.length===header.length)){
	    for(j=0,k=arg1.length;j<k;++j){
		if(arg1[j].length===2){
		    if (typeof arg1[j][0] === 'number'){
			tests.push([j,1,arg1[j][0]]);
		    }
		    if (typeof arg1[j][1] === 'number'){
			tests.push([j,-1,arg1[j][1]]);
		    }
		}
	    }
	} else if (typeof arg1 === 'object'){
	    for(j in arg1){ 
		if (arg1.hasOwnProperty(j)){
		    k = header.indexOf(j);
		    if (k === -1) console.log("CSV: hslice: warning "+j+" not found in header row");
		    if ((k>=0) && (arg1[j].length===2)){
			if (typeof arg1[j][0] === 'number'){
			    tests.push([k,1,arg1[j][0]]);
			}
			if (typeof arg1[j][1] === 'number'){
			    tests.push([k,-1,arg1[j][1]]);
			}   
		    }
		}
	    }
	} else throw "CSV: hslice incorrect args";
	// compiled tests, now run
	copy[0]=header;
	k=tests.length;
	for(i=1,l=data.rows.length;i<l;++i){
	    row = data.rows[i];
	    for(j=0, include=true; (include && (j<k)); ++j){
		t = tests[j];
		include = ( 
		    ( (t[1]===1) && (row[t[0]] >= t[2]) ) || 
			( (t[1]===-1) && (row[t[0]] <= t[2]) )
		);
	    }
	    if (include) copy.push(row);
	}
	data.rows = copy;
	if (copy.length === 1) console.log("CSV: hslice WARNING empty data -- supplied filters too strong, eliminated all row data");
	return shared.nextTask();
    }

    function table(divId, tableMakerOpt, b, e){
	var shared = this;
	var div;
	var rows = shared.data.rows.slice((b || 0),e);
	if ((tableMakerOpt === null) || (typeof tableMakerOpt === 'undefined')) tableMakerOpt = {};
	// if we need header data from row 0, make sure it is there
	if (tableMakerOpt.header &&  (b>0)) rows.unshift(shared.data.rows[0]);		
	if (divId.indexOf('#')===0) divId=divId.substr(1); // strip #
	div = $('#'+divId);
	if (div.length>0){ 
	    div.html(makeTable(rows, tableMakerOpt));
	} else {
	    $(document.body).append(['<div id="',
				     divId,
				     '">',
				     makeTable(rows, tableMakerOpt),
				     '</div>'
				    ].join(''));
	}
	if (tableMakerOpt && tableMakerOpt.dontCallNextTask) return true;
	return shared.nextTask();
    }

    function editor(divId, header, b, e, precall, onCell){
	var shared = this;
	var opt = {};
	var brow = b || 0;
	var stamp = 1 * new Date();
	var isDone = false;
	var doneId='editorDone'+stamp;
	var weCreatedThisDiv = ($('#'+divId).length===0);
	function onCellChange(){
	    var col = 1*$(this).data("col");
	    var row = 1*$(this).data("row");
	    var val = $(this).val();
	    val = (isNaN(1.0*val))? val: (1.0*val);
	    if (typeof onCell === 'function'){
		onCell(row,col,val,shared.data);
	    } else {
		if ( (row < shared.data.rows.length) &&
		     (col < shared.data.rows[row].length)
		   ) shared.data.rows[row][col] = val;
	    }
	}
	function onDone(){
	    if (!isDone){
		isDone = true;
		$('.'+opt.iclass).off('change',onCellChange);    
		if (weCreatedThisDiv){ 
		    $('#'+divId).remove();
		} else {
		    $('#'+divId).html("");
		}
		return shared.nextTask();
	    }
	}
	if (header) opt.header = true;
	opt.itype = 'text';
	opt.isize = 6;
	opt.iclass = 'editor'+stamp;
	opt.doneButtonText = 'Done';
	opt.cell = function(i,j,v){
	    return '<input type="'+
		opt.itype+
		'" size="'+
		opt.isize+
		'" class="'+
		opt.iclass+
		'" data-row="'+
		(1*brow+1*i)+
		'" data-col="'+
		j+
		'" value="'+
		v+
		'" />'; 
	};
	opt.dontCallNextTask = true;
	if (typeof precall === 'function'){
	    precall(opt);
	}
	table.apply(shared, [divId,opt,brow,e]);
	$('#'+divId).append('<button class="editorDoneButton" id="'+
			    doneId+
			    '" >'+
			    opt.doneButtonText+
			    '</button>');
	$('#'+doneId).click(onDone);
	$('.'+opt.iclass).on('change',onCellChange);
    }

    function pairs(pspec){
	var shared = this;
	var rows = shared.data.rows;
	var i,l,output = [];
	if ((typeof pspec !== 'object') || (pspec.length!==2))
	    throw "CSV: pairs pairspec must have length 2, got:"+pspec.length;
	if ((typeof pspec[0] === 'number') && 
	    (typeof pspec[1] === 'number')){
	    for(i=0,l=rows.length; i<l; ++i){
		output.push([rows[i][pspec[0]], rows[i][pspec[1]]]);
	    }
	} else {
	    output = shared.submatrix(null, pspec);
	}
	return output;
    }
    
    function jqplot(plotspec, after){
	var shared = this;
	var rows = shared.data.rows;
	var i,l,plots={},plotData=[];
	var plotName,plotPairs,plotOptions;
	if (typeof $.jqplot !== 'function')
	    throw "jqplot is not loaded.  You need to include the css and script tags for the jqplot library and any options";
	for(i=0,l=plotspec.length;i<l;++i){
	    plotName    = plotspec[i][0];
	    plotPairs   = plotspec[i][1];
	    plotOptions = plotspec[i][2];
	    if (plotName.indexOf('#')===0) plotName=plotName.substr(1); // strip # from div name
	    if ($('#'+plotName).length === 0){  // if div not in document, add it to body
		$(document.body).append('<div id="'+plotName+'"></div>');
	    }
	    $('#'+plotName).html(""); // clear div contents
	    plots[plotName] = $.jqplot(plotName, plotPairs.map(function(p){ return pairs.apply(shared,[p])}), plotOptions);
	}
	if (typeof after === 'function'){
	    after(plots);
	} 
	return shared.nextTask();
    }

    function appendCol(colName, colOrFunc, rowprops){
	var i,j,k,l;
	var shared = this;
	var rows = shared.data.rows;
	var header = [];
	var newc;
	var colData = [];
	var h=0;
	if (typeof colName === 'string'){
	    header = rows[0].slice(0);
	    h = 1;
	}
	newc = (header.length)? 
	    (header.length) : 
	    ( Math.max.apply(null, rows.each(function(r){ return r.length; })) );
	var rowobj = {};
	var row = [];
	if (typeof colOrFunc === 'object'){
	    if (colOrFunc.length===(rows.length-h)){
		colData = colOrFunc.slice(0);
	    } else if (rowprops === 'strict'){ 
		throw "CSV: addCol new columnn data length "+colOrFunc.length+" needed "+(rows.length-h);
	    } else {
		for(i=0,l=(rows.length-h); i<l; ++i){
		    j = i%(colOrFunc.length);
		    colData[i] = colOrFunc[j];
		}
	    }
	} else if (typeof colOrFunc === 'function'){ 		
	    if (rowprops){
		for(i=1,l=rows.length; i<l; ++i){
		    rowobj = {};
		    row = rows[i];
		    for(j=0,k=row.length;j<k;++j){
			rowobj[header[j]] = row[j];
		    }
		    colData[i-1] = colOrFunc(i, rowobj);
		}
	    } else {
		for(i=1,l=rows.length; i<l; ++i) colData[i-1]=colOrFunc(i,rows[i]);	    
	    }
	} else throw "CSV: appendCol second parameter must be data column or function";
	if (h) colData.unshift(colName);
	for(i=0,l=rows.length;i<l;++i) rows[i][newc]=colData[i];
	shared.nextTask();
    }

    function ols(fitspecs){
	var shared = this;
	var i,l;
	if (!numeric) throw "CSV: ols requires loading numeric.js";
	if ((typeof fitspecs !== 'object') || (!fitspecs.length)) throw "CSV: ols invalid fitspecs";
	for(i=0,l=fitspecs.length;i<l;++i){
	    // encapsulate each regression in an anonmoyous function
	    // to help identify to GC when memory is freed
	    (function(fit){
		var fitname, fitdep, fitindep;
		var X,Y,xT,xTxinv,xTy,B,residuals;
		var j,k;
		if (!shared.data.fit) shared.data.fit = {};
		try {
		    if ((typeof fit !== "object") || (fit.length!==3)) throw "CSV: ols - expected fitspec = [fitname, fitdep, fitindep] got "+fit.join(",");
		    fitname = fit[0];
		    fitdep  = fit[1];
		    fitindep = fit[2];
		    X = shared.submatrix(null, fitindep);
		    Y = shared.submatrix(null, [fitdep]);
		    if (!X || (!X.length)) throw "CSV: ols "+fitname+" internal matrix X invalid";
		    if (!Y || (!Y.length)) throw "CSV: ols "+fitname+" internal matrix Y invalid";
		    xT = numeric.transpose(X);
		    if (!xT || (!xT.length)) throw "CSV: ols "+fitname+" internal matrix xT invalid";
		    xTxinv = numeric.inv(numeric.dot(xT,X));
		    if (!xTxinv || (!xTxinv.length)) throw "CSV: ols "+fitname+" internal matrix xTxinv invalid";
		    xTy = numeric.dot(xT,Y);
		    if (!xTy || (!xTy.length)) throw "CSV: ols "+fitname+" internal matrix xTy invalid";
		    B = numeric.transpose(numeric.dot(xTxinv,xTy));
		    if (!B || (!B.length)) throw "CSV: ols "+fitname+" internal matrix B invalid";
		    B=B[0]; // flatten
		    if (!B || (!B.length)) throw "CSV: ols "+fitname+" error flattening B";
		    for(j=0,k=B.length; j<k; ++j){
			if ((typeof B[j] !== 'number') || 
			    (isNaN(B[j])) || 
			    ( (Math.abs(B[j])) === Infinity )
			   ) throw "CSV: ols "+fitname+" error invalid beta - NaN or Inf - possible multicollinearity in indep vars";
		    }
		    
		    shared.data.fit[fitname] = {'name': fitname,
						'dep': fitdep,
						'indep': fitindep,
						'beta': B};
		    
		} catch(e){ 
		    console.log(e);
		    shared.data.fit[fitname]={'name': fitname,
					      'dep': fitdep,
					      'indep': fitindep,
					      'error': e
					     };
		}
	    })(fitspecs[i]);
	}
	return shared.nextTask();
    }

    function pca(indep, options){
	var shared = this;
	var X=shared.submatrix(null, indep);
	var C=shared.colAvg(X);
	var V=shared.colVar(X, (options && options.ssc), (!options || !options.center) );
	var i,j,k,l,adjX=[];
	shared.data.pca = {
	    'indep': indep,
	    'options': options,
	    'mean':  C,
	    'variance': V
	}; 
	if (!window.numeric) throw "CSV: pca requires loading numeric.js";
	for(i=0,l=X.length; i<l; ++i){
	    adjX[i] = [];
	    for(j=0,k=X[i].length; j<k; ++j){
		adjX[i][j] = X[i][j];
		if (options && options.center) adjX[i][j] += -1*C[j];
		if (options && options.scale)  adjX[i][j] *=  1/Math.sqrt(V[j]);
	    }	    
	}
	shared.data.pca.adjX = adjX; 
	shared.data.pca.svd = numeric.svd(adjX);
	if (options && options.newcols){ 
	    Array.prototype.push.apply(shared.data.rows[0], options.newcols); 
	    for(i=1,l=shared.data.rows.length;i<l;++i)
		for(j=0,k=options.newcols.length; j<k; ++j)
		    shared.data.rows[i].push(shared.data.pca.svd.U[(i-1)][j]*shared.data.pca.svd.S[j]);
	}
	if (options && options.trash) delete shared.data.pca;
	return shared.nextTask();
    }
    
    function download(dlname, strict){
	// download via blob(IE) or dataURL and self-clicking link (others)
	// if strict is truthy, any error is thrown and sent to final callback
	// otherwise, errors are ignored
	// I would like to thank adeneo, http://stackoverflow.com/users/965051/adeneo
	// for inspiration and showing me how to use a data URL this way
	// in http://stackoverflow.com/questions/17836273/export-javascript-data-to-csv-file-without-server-interaction
	// Adaneo's solution works on Firefox and Chrome
	// Later Manu Sharma proposed an IE solution
	// in http://stackoverflow.com/a/27699027/103081
	var shared = this;
	var rows=shared.data.rows;
	var i,l, csvString='', errormsg='';
	var fname = dlname || (csvname+'.csv');
	for(i=0,l=rows.length; i<l; ++i) csvString += '"'+rows[i].join('","')+'"'+"\n";
	// try IE solution first
	if (window.navigator && window.navigator.msSaveOrOpenBlob) {
	    try {
		var blob = new Blob(
		    [decodeURIComponent(encodeURI(csvString))], {
			type: "text/csv;charset=utf-8;"
		    });
		navigator.msSaveBlob(blob, fname);
	    } catch(e){ 
		errormsg = "error on CSV.download, IE blob branch:"+e;
		console.log(errormsg);
		if (strict) throw errormsg; 
	    }
	} else {
	    // try Firefox/Chrome solution here
	    try {
		var a = document.createElement('a');
		if (!('download' in a)) throw "a does not support download";
		a.href = 'data:attachment/csv,'+encodeURIComponent(csvString);
		a.target = '_blank';
		// use class instead of id here -- PJB 2015.01.10
		a.class = 'dataURLdownloader';
		a.download = fname;
		document.body.appendChild(a);
		a.click();
	    } catch(e){
		errormsg = "error on CSV.download, data url branch:"+e;
		console.log(errormsg);
		if (strict) throw errormsg; 
	    }
	}
	shared.nextTask();
    }

    function save(csvSaveName){
	var shared = this;
	var csvname = csvSaveName || shared.init.csvName; 
	if (!csvname) throw "CSV: save: missing csvSaveName or csvName ";
	var splitname = csvname.split('/');
	var isLocalCSV = ( (splitname[0]==='local') || (splitname[0]==='session') );
	if (isLocalCSV){ 
	    localCreate(csvname, shared.data.rows, shared.data.meta);
	} else {
	    return shared.ajaxMapper.apply(shared, 
					   ["save", csvname, shared.data]
					  );
	}	   
	shared.nextTask();
    }
    
    function begin(arg1,arg2){
	// was begin(csvname, newCSVData, newCSVOptions)
	var splitname;
	var shared = $.extend({}, csvShared); // clone csvShared
	shared.init = {}; // add new empty objects
	shared.data = {};
	if (typeof arg2 === "string"){ 
	    try { 
		shared.init.options = JSON.parse(arg2);
	    } catch(e){ 
		throw "CSV: begin unknown option string "+arg2;
	    }
	} else if (typeof arg2 === "object"){
	    shared.init.options = arg2;
	}
	if ((typeof arg1 === "string") && (arg1.length>0)){
	    if (arg1.indexOf("\n") >= 0){
		// arg1 is CSV data
		shared.init.csvString = arg1;
	    } else if ((arg1.indexOf("/")===0) ||
		       (arg1.indexOf("http://")==0) ||
		       (arg1.indexOf("https://")==0) ) {
		shared.init.getURL = arg1; 
	    } else if ( arg1.indexOf("/")>0 ){ 
		// arg1 is a csvName
		shared.init.csvName = arg1;
	    } else if (
		(typeof shared.specialNames === 'object') &&
		    ( arg1 in shared.specialNames ) &&
		    (shared.specialNames.hasOwnProperty(arg1))
	    ){
		shared.init.specialName = arg1;
	    } else {
		// maybe it is a jQuery selector
		shared.init.jqName = arg1;
	    }
	} else if (typeof arg1 ===  "function"){ 
	    shared.init.fetcher = arg1;
	} else if (typeof arg1 === "object" && (arg1.length>0)){
	    shared.init.data = arg1;
	} else if (typeof arg1 === "object"){ 
	    if (typeof arg1.url === "string"){ 
		shared.init.ajax = arg1;
	    } else throw "CSV: begin unknown parameter object arg1 "+JSON.stringify(arg1);
	} else if (typeof arg1 === 'number'){
	    shared.init.fill = arg1;
	} else throw "CSV: unknown parameter arg1 "+JSON.stringify(arg1);
	
	shared.isLocal = (shared.init.csvName) && (
	    (shared.init.csvName.indexOf('local')===0) || (shared.init.csvName.indexOf('session')===0) );
	
	shared.cando = Object.keys(csvFuncs);
	shared.candone = [
	    'finalize', finalize,
	    'go', go
	];
	shared.todo = [{f: fetch, a: null}];
	
	
	function finalize(func, taskms){
	    if (taskms){ shared.taskDelay = taskms }
	    if (typeof func === 'function') shared.finalCallback = func;
	    // we can't return nextTask directly, because someone might
	    // add parmeters and that would cause a malfunction
	    // making sure repeated calls are ignored requires
	    //   having some flags, and then resetting things when the
	    //   workflow completes so that it is "armed" again
	    var armed = true;
	    var replay = shared.todo.slice(0);
	    var count = 0;
	    return function(){
		if (shared.todo === 0){
		    delete shared.data;
		    shared.todo = replay.slice(0);
		    armed = true;
		}
		if (armed) { 
		    armed = false; 
		    shared.nextTask();
		    ++count;
		    return count;
		} 
		console.log("CSV: ignored call to finalize() while previous call in progress");
		return null;
	    }
	}

	function go(func, taskms){
	    (finalize(func, taskms))(); 
	    // starts list of chained tasks executing
	    // go signifies the end of a request -->
	    //       so do not return methods to chain more requests
	}

	return planner(shared.cando, shared.candone, shared.todo);

    }

    return CSVRETURN;
})();
