var express = require('express');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var memwatch = require('memwatch');

var path = require('path');
var fs = require('fs');
var async = require('async');
//var util = require('util');

global.torrent_path = '/data/torrent';
global.download_path = '/data/down';

// memory leak check
memwatch.on('leak', function(info) {
	console.error('memwatch-leak');
	console.error(info);
});

// transmission
var transmission = require('./transmission');

// scheduler
var scheduler = require('./scheduler');

// engine-loader
var engine_loader = require('./engine-loader');

// app laod
app = express();

app.set('scheduler', scheduler);
app.set('transmission', transmission);
app.set('engine_loader', engine_loader);

var ECT = require('ect');
//var ectRenderer = ECT({ watch: true, root: __dirname + '/views', ext : '.ect' });
var ectRenderer = ECT({ watch: true, root: __dirname + '/views', ext : '.ect' });

// view engine setup
app.engine('ect', ectRenderer.render);
app.set("views", __dirname + '/views');
app.set("view engine", "ect");

app.use(logger('dev'));
app.use(cookieParser());
app.use(expressSession({
	secret:'torrent-down#2014#@)',
	cookie: { maxAge: 60000 },
	saveUninitialized: true,
	resave:true,
}));
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


var routes = require('./routes/index');

app.use('/', routes);

app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: err
	});
});

app.set('port', process.env.PORT || 8080);
app.listen(app.get('port'), function() {
	console.log('listening.. ' + app.get('port'));

	engine_loader.verify_engines(function() {
		console.log('engine ping');
	});
	scheduler.process();
});
