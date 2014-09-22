var express = require('express');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');

var path = require('path');
var fs = require('fs');
var async = require('async');
//var util = require('util');

//load engines 
global.engines = [];
var files = fs.readdirSync(path.join(__dirname, '/engines'));
files.forEach(function(file) {
	engines.push(require(path.join(__dirname,'/engines',file)).get());
});

//load scheduler
global.schedules = require(path.join(__dirname,'schedule'));
var schedulesQue = [];
var weekname = ['일', '월', '화', '수', '목', '금', '토'];

function downloadProcess(target) {
	console.log('자동 다운로드 시작');
	console.log(target);


	var tasks = [];
	engines.forEach(function(engine) {
		if (engine.enable && engine.mapping) {
			var type = engine.mapping[target.type];
			if (type) {
				tasks.push(function(next) {
					engine.search(type, target.keyword, 1, function(err, result) {
						if (result && result.length) {
							var select = result[0];
							result.forEach(function (item) {
								if (item.title.indexOf(item.relname)!=-1) {
									select = item;
									return;
								}
							});
							engine.download(select.value, select.title, function(err, files) {
								var result = [];
								if (err) {
									console.log(err);
									next();
									return;
								}
								files.forEach(function(file) {
									var ext = path.extname(file).toLowerCase();
									if (ext=='.torrent') {
										fs.rename(file, '/data/torrent/' + file);
										console.log('[TORRENT] '+file+' (Downloading..)');
									} else {
										fs.rename(file, '/data/download/' + file);
										console.log('[다운로드] '+file+' (Downloaded)');
									}
								});

							});
						}
					});
				});
			}
		}
	});
	
	async.series(tasks, function() {
		console.log('자동 다운로드 끝');
	});
}

function scheduleProcess() {
	schedules = require(path.join(__dirname,'schedule'));

	var now = new Date();
	schedules.forEach(function(item, index) {
		if (item.type=='매주' && item.week==now.getDay()) {
			var remainMin = (item.hour * 60 + item.minute) - (now.getHours() * 60 + now.getMinutes());

			if (remainMin > 0 && remainMin <= 90 && !item.queue) {
				item.queue = true;
				console.log(item.title + ' ' + remainMin + '분후에 다운로드 시작');
				setTimeout(function() {
					downloadProcess(item.target, index);
					item.queue = false;
				}, remainMin * 60 * 1000);
			}
		}
	});

	var perHourTick = 60 * 60;

	setTimeout(function() {
		scheduleProcess();
	}, perHourTick * 1000); // 한시간에 한번
}

/* auto verify
 ------------------------------------------------------------------------------------ */
global.verify_engines = function(callback) {
	var tasks = [];
	var starttime = +new Date();
	engines.forEach(function(item) {
		item.enable = true;
		tasks.push(function(next) {
			item.verify(function(err) {
				var endtime = +new Date();
				item.ping = ((endtime - starttime)/1000).toFixed(2);
				if (err) item.enable = false;
				next();
			});
		});
	});
	async.parallel(tasks, function(err) {
		callback(err);
	});
}
setInterval(function() {
	verify_engines(function(err) {
		console.log('auto verify');
	});
}, 60*60*1000);
verify_engines(function(err) {
	console.log('auto verify');
});

// app laod
app = express();

var ECT = require('ect');
var ectRenderer = ECT({ watch: true, root: __dirname + '/views', ext : '.ect' });

// view engine setup
app.engine('ect', ectRenderer.render);
app.set("view engine", "ect");
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(cookieParser());
app.use(expressSession({
	secret:'torrent-down#2014#@)',
	cookie: { maxAge: 60000 },
	saveUninitialized: true,
	resave:true,
}));

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
});
