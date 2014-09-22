var util = require('util');
var fs = require('fs');
var path = require('path')
var async = require('async')
var express = require('express');
var Transmission = require('transmission');
var router = express.Router();

var engines = global.engines;
var schedules = global.schedules;

/* torrent
 ------------------------------------------------------------------------------------ */
var transmission = new Transmission({
    port: 9091,
    host: '192.168.0.11',
	username: 'transmission',
	password: 'transmission',
});

function _engine(name) {
	var current = engines[0];
	engines.forEach(function(item) {
		if (item.name==name) {			
			current = item;
		}
	});
	return current;
}

router.use('/verify', function (req, res, next) {
	global.verify_engines(function(err) {
		res.redirect('/');
	});
});

router.get('/search', function(req, res, next) {
	var engine = _engine(req.session['engine']);
	var type = req.query['type'];
	var keyword = req.query['keyword'];
	var page = req.query['page'];
	if (!page) page = 1;
	page = parseInt(page);

	var locals = {
		result: [],
		page: page,
		type: type,
		keyword: keyword,
	};

	if (type) {
		engine.search(type, keyword, page, function(err, result) {
			locals.result = result;
			res.render('search', locals);
		});
	} else {
		res.render('search', locals);
	}
});


router.use('/download', function (req, res, next) {
	var engine = _engine(req.session['engine']);
	var value = req.query['value'];
	var title = req.query['title'];
	console.log(value);
	console.log(title);

	var locals = {
		alertmsg: '',
		results: [],
	};

	if (value) {
		engine.download(value, title, function(err, files) {
			console.log('complete');
			console.log(err);

			if (err) {
				locals.alertmsg = util.inspect(err);
			}

			files.forEach(function(file) {
				var item = {
					file: file,
					ext: path.extname(file).toLowerCase()
				};
				if (item.ext=='.torrent') {
					fs.rename(item.file, '/data/torrent/' + item.file);
				} else {
					fs.rename(item.file, '/data/download/' + item.file);
				}
				locals.results.push(item);
			});

			res.render('download', locals);
		});
	} else {
		res.render('download', locals);
	}
});

router.use('/torrent', function (req, res, next) {
	var alertmsg = '';
	var error = {};
	var summary = {};
	var torrents = [];
	transmission.get(function(err, result) {
		if (err) {
			console.log(err);
			error = util.inspect(err);
		} else {
			summary.pauseCount = 0;
			summary.queueCount = 0;
			summary.downloadCount = 0;
			summary.seedingCount = 0;
			result.torrents.forEach(function(torrent) {
				if (torrent.status==6) summary.seedingCount++;
				else if (torrent.status==4) summary.downloadCount++;
				else if (torrent.status==3) summary.queueCount++;
				else summary.pauseCount++;
				//if (torrent.status!=3 && torrent.status!=4) return;
				if (!torrent.status) return;
			});
			torrents = result.torrents;
		}

		alertmsg = req.session['flash_message'];
		req.session['flash_message'] = null;

		res.render('torrent', {
			error: error,
			alertmsg: alertmsg,
			summary: summary,
			torrents: torrents,
		});
	});
});

router.use('/torrent-file', function (req, res, next) {
	var filename = req.query['file'];

	console.log(filename);
	res.writeHead(302, {'Content-Type':'file/unkown'});

	var fileStream = fs.createReadStream(filename);
	fileStream.pipe(res);
});

router.use('/torrent-pause-clear', function (req, res, next) {
	var tasks = [];
	var count = 0;

	transmission.get(function(err, result) {
		result.torrents.forEach(function(torrent) {
			if (torrent.status==0 && torrent.hashString) {
				(function(hash) {
					console.log('#'+hash);
					tasks.push(function(next) {
						transmission.remove(hash, req.query['delete']=='true', function(err, result) {
							count++;
							next();
						});
					});
				})(torrent.hashString);
			}
		});

		async.parallel(tasks, function(err) {
			req.session['flash_message'] = '#' + count + ' torrent was removed';
			console.log('#' + count + ' torrent was removed');
			res.redirect('/torrent');
		});
	});
});


router.use('/torrent-del', function (req, res, next) {
	if (req.query['id']) {
		// 삭제
		var deleteId = req.query['id'];
		transmission.remove(deleteId, req.query['delete']=='true', function(err, result) {
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

router.get('/', function(req, res, next) {
	if (req.query['engine']) {
		req.session['engine'] = req.query['engine'];
	}
	console.log(req.session['engine']);
	var engine = _engine(req.session['engine']);

	engines.sort(function(a, b) {
		return a.ping - b.ping;
	});

	res.render('index', {
		engines: engines,
		engine: engine,
		schedules: schedules,
	});
});

module.exports = router