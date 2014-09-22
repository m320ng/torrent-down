var Transmission = require('transmission');
var connect = require('connect');
var async = require('async');
var util = require('util');
var fs = require('fs');
var _path = require('path')
var engines = [];


var files = fs.readdirSync('./engines');

// load engines
files.forEach(function(file) {
	engines.push(require('./engines/'+file).get());
});


/* helper
 ----------------------------------------------------------------------------------- */
function sizeFormat(b) {
	if (1024 * 1024 * 1024 < b) {
		return (b / (1024 * 1024 * 1024)).toFixed(2) + 'G';
	}
	else if (1024 * 1024 < b) {
		return (b / (1024 * 1024)).toFixed(2) + 'MB';
	}
	else if (1024 < b) {
		return parseInt(b / 1024) + 'KB';
	}
	return b;
}

var wrapHtml = function(text, alert) {
	if (alert) {
		alert = [
			'<p class="alert alert-info">',
			alert,
			'</p>',
		].join('\n');
	} else {
		alert = '';
	}
	
	var tpl = [
		'<!DOCTYPE html>',
		'<html lang="en">',
		'<head>',
		'<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
		'<meta http-equiv="X-UA-Compatible" content="IE=Edge">',
		'<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
		'<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">',
		'<!--[if lt IE 9]>',
		'<script src="https://oss.maxcdn.com/html5shiv/3.7.2/html5shiv.min.js"></script>',
		'<script src="https://oss.maxcdn.com/respond/1.4.2/respond.min.js"></script>',
		'<![endif]-->',
		'</head>',
		'<body>',
		'<div class="container">',
		alert,
		text,
		'</div>',
		'<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>',
		'<script src="//maxcdn.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>',
		'</body>',
		'</html>',
	];
	return tpl.join('\n');
}

/* torrent
 ------------------------------------------------------------------------------------ */
var transmission = new Transmission({
    port: 9091,
    host: '192.168.0.11',
	username: 'transmission',
	password: 'transmission',
});
transmission.statusname = {
	'6':'Seeding',
	'4':'Downloading',
	'3':'Queued',
	'0':'Paused',
};

/* schedule
 ------------------------------------------------------------------------------------ */
var schedules = require('./schedule');
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
									var ext = _path.extname(file).toLowerCase();
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
	/*
	if (!target.engine.length) {
		target.engine = [target.engine];
	}
	target.engine.forEach(function(engineInfo) {
		if (success) return;
		var engine = _engine(engineInfo.name);
		if (engine.name==engineInfo.name) {
		}
	});
	*/
}

function scheduleProcess() {
	schedules = require('./schedule');

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
setInterval(function() {
	verify_engines(function(err) {
		console.log('auto verify');
	});
}, 60*60*1000);


/* web-ui
 ------------------------------------------------------------------------------------ */
var app = connect();

app.use(connect.logger('tiny'));
app.use(connect.query()); 
app.use(connect.cookieParser()); 
app.use(connect.session({
	secret: 'h42319u002p0ku73',
}));

function _engine(name) {
	var current = engines[0];
	engines.forEach(function(item) {
		if (item.name==name) {			
			current = item;
		}
	});
	return current;
}

app.use('/search', function (req, res, next) {
	var engine = _engine(req.session['engine']);
	var type = req.query['type'];
	var keyword = req.query['keyword'];
	var page = req.query['page'];
	if (!page) page = 1;
	page = parseInt(page);
	console.log(type);
	console.log(keyword);

	if (type) {
		engine.search(type, keyword, page, function(err, result) {
			//console.log(result);
			var resultTag = [];
			var html = [];
			html.push([
				'<script type="text/javascript">',
				'function next(page) {',
				'var form = document.forms[\'search-form\'];',
				'form["page"].value = page;',
				'form.submit();',
				'}',
				'</script>',
				'<form name="search-form">',
				'<input type="hidden" name="type" value="',type,'"/>',
				'<input type="hidden" name="page" value="',page,'"/>',
				'<input type="hidden" name="keyword" value="',keyword,'"/>',
				'</form>',
				'<div class="panel panel-info" style="overflow:hidden;">',
				'<div class="panel-heading">검색결과 <span class="badge">',result.length,'</span></div>',
				'<div class="table-responsive">',
				'<table class="table table-striped">',
			].join(''));
			if (result && result.length) {
				result.forEach(function(item) {
					html.push([
						'<tr>',
						'<td>',
						'<a href="/download?value=',encodeURIComponent(item.value),'&title=',encodeURIComponent(item.title),'">',
						item.title,
						'</a> ',
						'<a href="',item.info,'" class="badge" target="_blank" style="background:#5cb85c;">INFO</a>',
						'</td>',
						'<td>',
						'<a href="/download?value=',encodeURIComponent(item.value),'&title=',encodeURIComponent(item.title),'" class="btn btn-primary btn-xs" style="float:right;"><span class="glyphicon glyphicon-download"></span> Download</a>',
						'</td>',
						'</tr>',
					].join(''));
				});
			} else {
				html.push('<tr><td>결과없음</td></tr>');
			}
			html.push([
				'</table>',
				'</div>',
				'</div>',
			].join(''));
			res.end(wrapHtml([
				html.join('\n'),
				'<a href="/" class="btn btn-default"><span class="glyphicon glyphicon-home"></span> 처음으로</a>',
				'<a href="javascript:next(',(page+1),');" class="btn btn-default"><span class="glyphicon glyphicon-chevron-right"></span> 다음페이지</a>',
				'<a href="javascript:history.back();" class="btn btn-default"><span class="glyphicon glyphicon-eject"></span> 뒤로가기</a>'
			].join('\n')));
		});
		return;
	}
	res.end(wrapHtml('error'));
});

app.use('/download', function (req, res, next) {
	var engine = _engine(req.session['engine']);
	var value = req.query['value'];
	var title = req.query['title'];
	console.log(value);
	console.log(title);

	if (value) {
		engine.download(value, title, function(err, files) {
			console.log('complete');
			console.log(err);

			var result = [];

			if (err) {
				result.push([
					'<p class="alert alert-danger">',
					util.inspect(err),
					'</p>',
				].join(''));
			}

			files.forEach(function(file) {
				var ext = _path.extname(file).toLowerCase();
				if (ext=='.torrent') {
					fs.rename(file, '/data/torrent/' + file);
					result.push([
						'<p class="alert alert-success">',
						'<span class="glyphicon glyphicon-ok"></span> ',
						'<a href="#" class="alert-link">TORRENT</a> ',
						'<strong>',file,'</strong>',
						' (Downloading..)',
						'</p>',
					].join(''));
				} else {
					fs.rename(file, '/data/download/' + file);
					result.push([
						'<p class="alert alert-success">',
						'<span class="glyphicon glyphicon-ok"></span> ',
						'<a href="#" class="alert-link">다운로드</a> ',
						'<strong>',file,'</strong>',
						' (Downloaded)',
						'</p>',
					].join(''));
				}
			});
			res.end(
				wrapHtml([
					result.join('\n'),
					'<a href="/" class="btn btn-default"><span class="glyphicon glyphicon-home"></span> 처음으로</a>'
				].join('\n'))
			);
		});
		return;
	}
	res.end(wrapHtml('error'));
});

app.use('/torrent-file', function (req, res, next) {
	var filename = req.query['file'];

	console.log(filename);
	res.writeHead(302, {'Content-Type':'file/unkown'});

	var fileStream = fs.createReadStream(filename);
	fileStream.pipe(res);
});

app.use('/torrent-del', function (req, res, next) {
	if (req.query['id']) {
		// 삭제
		var deleteId = req.query['id'];
		transmission.remove(deleteId, true, function(err, result) {
			if (err) {
				req.session['flash_message'] = '오류가 발생했습니다.';
			} else {
				req.session['flash_message'] = '#' + deleteId + ' torrent was removed';
				console.log('#' + deleteId + ' torrent was removed');
				console.log(result);
			}
			res.writeHead(302, {Location:'/torrent'});
			res.end();
		});
		return;
	}

	res.writeHead(302, {Location:'/torrent'});
	res.end();
});
app.use('/torrent', function (req, res, next) {
	var html = [];
	transmission.get(function(err, result) {
		if (err) {
			console.log(err);
			html.push([
				'오류가 발생했습니다.',
				util.inspect(err),
			].join('<br/>'));
			return;
		}

		var torrentResult = [];
		torrentResult.push([
			'<thead>',
			'<tr class="background:#f4f4f4;">',
				'<th>#</th>',
				'<th>Status</th>',
				'<th>Name</th>',
				'<th>%</th>',
				'<th>Size</th>',
				'<th>StartDate</th>',
				'<th>Del</th>',
			'</tr>',
			'</thead>',
		].join('\n'));
		torrentResult.push('<tbody>');

		var pauseCount = 0;
		var queueCount = 0;
		var downloadCount = 0;
		var seedingCount = 0;
		result.torrents.forEach(function(torrent) {
			if (torrent.status==6) seedingCount++;
			else if (torrent.status==4) downloadCount++;
			else if (torrent.status==3) queueCount++;
			else pauseCount++;
			//if (torrent.status!=3 && torrent.status!=4) return;
			if (!torrent.status) return;
			torrentResult.push([
				'<tr>',
				'<td class=""><small>',torrent.id,'</small></td>',
				'<td><span class="label label-xs label-',(torrent.status==6?'warning':torrent.status==4?'info':'default'),'">',transmission.statusname[torrent.status],'</span></td>',
				'<td>',torrent.name,' ',
				'<a href="/torrent-file?file=',torrent.torrentFile,'" class="btn btn-success btn-xs">.torrent</a>',
				'</td>',
				'<td class="text-info"><small>',(torrent.percentDone * 100).toFixed(2),'%</small></td>',
				'<td class="text-success"><small>',sizeFormat(torrent.totalSize),'</small></td>',
				'<td class="text-info"><small>',(new Date(torrent.startDate * 1000)).toISOString().replace(/T/,' ').replace(/\..+/,''),'</small></td>',
				'<td>',
				'<a href="/torrent-del?id=',torrent.hashString,'" class="btn btn-danger btn-xs">del</a>',
				'</td>',
				'</tr>',
			].join(''));
		});
		torrentResult.push('</tbody>');

		var summary = [
			'<span class="label label-default">Pause ',pauseCount,'</span>',
			'<span class="label label-primary">Downloading ',downloadCount,'</span>',
			//'<span class="label label-success">Success</span>',
			'<span class="label label-info">Queue ',queueCount,'</span>',
			'<span class="label label-warning">Seeding ',seedingCount,'</span>',
			//'<span class="label label-danger">Danger</span>'
		].join('');

		html.push([
			'<div class="panel panel-info">',
				'<div class="panel-heading">torrents <span class="badge">',result.torrents.length,'</span></div>',
				'<div class="panel-body">',
				summary,
				'</div>',
				'<div class="table-responsive">',
				'<table class="table table-striped">',
				torrentResult.join('\n'),
				'</table>',
				'</div>',
			'</div>',
		].join('\n'));


		var alert = req.session['flash_message'];
		req.session['flash_message'] = null;

		res.end(wrapHtml([
			html.join('\n'),
			'<a href="/" class="btn btn-default"><span class="glyphicon glyphicon-home"></span> 처음으로</a>'
		].join('\n'), alert));
	});
});

app.use('/verify', function (req, res, next) {
	verify_engines(function(err) {
		res.writeHead(302, {Location:'/'});
		res.end();
	});
});

app.use('/', function (req, res, next) {
	if (req.query['engine']) {
		req.session['engine'] = req.query['engine'];
	}
	//console.log(req.session['engine']);
	var engine = _engine(req.session['engine']);

	engines.sort(function(a, b) {
		return a.ping - b.ping;
	});

	var engineBtn = [];
	engines.forEach(function(item) {
		if (item.enable) {
			engineBtn.push(['<a class="btn ',(item.name==engine.name?'btn-primary':'btn-default'),' btn-sm" href="/?engine=',item.name,'">','<span class="glyphicon glyphicon-log-in"></span> ',item.name,' <span class="badge">',item.ping,'</span>','</a>'].join(''));
		} else {
			engineBtn.push(['<a class="btn btn-sm" style="background:#eee;" href="#">','<span class="glyphicon glyphicon-ban-circle"></span> ',item.name,' <span class="badge">off</span>','</a>'].join(''));
		}
	});

	var options = [];
	for (var k in engine.typelist) {
		options.push(['<option value="',k,'">',engine.typelist[k],'</option>'].join(''));
	}

	// 스케쥴표
	var scheduleResult = [];
	scheduleResult.push([
		'<tr style="background:#f4f4f4;">',
		'<th>#</th>',
		'<th>예약항목</th>',
		'<th>예약시간</th>',
		'</tr>',
	].join(''));
	schedules.forEach(function(item) {
		scheduleResult.push([
			'<tr>',
			'<td>',(scheduleResult.length),'</td>',
			'<td>',
			'<strong>',item.title,'</strong> ',
			'</td>',
			'<td>',
			'<span class="label label-success">',
			'<span class="glyphicon glyphicon-time"></span> ',
			item.type,' ',
			weekname[item.week]+'요일 ',
			item.hour,'시 ',item.minute,'분 ',
			'</span>',
			'</td>',
			'</tr>',
		].join(''));
	});

	res.end(
		wrapHtml([
		'<div class="btn-group btn-group-sm" style="padding:10px 0;">',
		engineBtn.join(''),
		'</div>',
		'<form role="form" action="/search" method="get">',
		'<div class="form-group">',
		'<label>카테고리</label>',
		'<select name="type" class="form-control">',
		options.join('\n'),
		'</select>',
		'</div>',
		'<div class="form-group">',
		'<label>검색어</label>',
		'<input type="input" class="form-control" name="keyword" value=""/>',
		'</div>',
		'<button type="submit" class="btn btn-primary"><span class="glyphicon glyphicon-search"></span> 검색</button>',
		'</form>',
		'<p>',
		'<div class="btn-group btn-group-justified">',
		'<a href="\\\\192.168.0.11\\share\\download" class="btn btn-warning"><span class="glyphicon glyphicon-folder-open"></span> 다운로드 폴더열기</a>',
		'<a href="/verify" class="btn btn-info"><span class="glyphicon glyphicon-time"></span> 접속정보갱신</a>',
		'<a href="/torrent" class="btn btn-success"><span class="glyphicon glyphicon-download"></span> Torrent현황</a>',
		'</div>',
		'</p>',
		'<div class="panel panel-info">',
		'<div class="panel-heading">예약다운로드 <span class="badge">',schedules.length,'</span></div>',
		'<div class="panel-body">',
		'자동으로 다운받는 항목들입니다.',
		'</div>',
		'<table class="table">',
		scheduleResult.join('\n'),
		'</table>',
		'</div>',
		].join('\n'))
	);
});

/* main
 ------------------------------------------------------------------------------------ */
function verify_engines(callback) {
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

// start server
app.listen(8080, function() {
	console.log('listening..');
	scheduleProcess();
});

verify_engines(function(err) {
	if (err) console.log(err);
	/*
	if (true) {
		for (var i=engines.length-1; i>=0; i--) {
			if (!engines[i].enable) {
				console.log('remove ' + engines[i].name);
				delete engines[i];
			}
		}
	}
	*/
	console.log('verify complete');
});


/*
function scheduleProcess(first) {
	var now = new Date();
	schedules.forEach(function(item) {
		if (item.type=='매주' && item.week==now.getDay() && item.hour==now.getHours()) {
			var delayMin = first ? item.minute - now.getMinutes() : item.minute;
			if (delayMin >= 0) {
				console.log(item.title + ' ' + delayMin + '분후에 다운로드 시작');
				setTimeout(function() {
					downloadProcess(item.target);
				}, delayMin * 60 * 1000);
			}
		}
	});

	var perHourTick = (60 - now.getMinutes()) * 60;

	setTimeout(function() {
		scheduleProcess(false);
	}, perHourTick * 1000); // 한시간에 한번
}
*/
