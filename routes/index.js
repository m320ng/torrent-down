var util = require('util');
var fs = require('fs');
var http = require('http');
var path = require('path')
var async = require('async')
var mkdirp = require('mkdirp')
var express = require('express');
var group = require('../group');
var router = express.Router();

function getExtension(filename) {
    var ext = path.extname(filename||'').split('.');
    return ext[ext.length - 1];
}

function getParentPath(path) {
	return fs.realpathSync(path + '/..');
}

router.use('/verify', function (req, res, next) {
	var loader = app.get('engine_loader');
	loader.verify_engines(function(err) {
		res.redirect('/');
	});
});

router.get('/search', function(req, res, next) {
	var loader = app.get('engine_loader');
	var engine = loader.get(req.query['engine']||req.session['engine']);
	var type = req.query['type'];
	var keyword = req.query['keyword'];
	var page = req.query['page'];
	if (!page) page = 1;
	page = parseInt(page);

	var locals = {
		engine: {
			name: engine.name,
			host: engine.host,
		},
		result: [],
		page: page,
		type: type,
		keyword: keyword,
		group: group,
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


router.use('/arrange', function(req, res, next) {
	var smiExtensions = ['smi'];
	var movieExtensions = ['avi', 'mkv', 'mp4', 'mpeg', 'mpg', 'mpe', 'wmv', 'asf', 'asx', 'flv', 'rm', 'mov', 'dat'];
	var spath = !!req.body.path ? req.body.path : global.download_path;
	var mode = !!req.body.mode ? req.body.mode : 'smi';
	var smipath = !!req.body.smipath ? req.body.smipath : '';
	var newname = !!req.body.newname ? req.body.newname : '';
	var movepos = !!req.body.movepos ? req.body.movepos : '';

	if(mode == 'match') {

		res.render('arrange-input', {
			path: spath,
			smipath: smipath,
			newname: path.basename(spath, path.extname(spath))
		});
	} else if(mode == 'process') {

		if(!newname) {
			res.render('arrange-success', {
				error: '동영상 이름이 입력되지 않았습니다.'
			});
		} else if(!movepos || (movepos != 'movie' && movepos != 'smi') ) {
			res.render('arrange-success', {
				error: '이동위치가 선택되지 않았습니다.'
			});
		} else if(!spath) {
			res.render('arrange-success', {
				error: '동영상이 선택되지 않았습니다.'
			});
		} else if(!smipath) {
			res.render('arrange-success', {
				error: '자막이 선택되지 않았습니다.'
			});
		} else {

			if(!fs.existsSync(spath) || !fs.existsSync(smipath)) {
				res.render('arrange-success', {
					error: '파일이 존재하지 않습니다.'
				});
				return;
			}

			var movieExtension = getExtension(spath);
			var smiExtension = getExtension(smipath);
			var movePath = '';

			if(movepos == 'movie') {
				movePath = path.dirname(spath);
			} else {
				movePath = path.dirname(smipath);
			}

			var movieFile = movePath + '/' + newname + path.extname(spath);
			var smiFile = movePath + '/' + newname + path.extname(smipath);

			fs.renameSync(spath, movieFile);
			fs.renameSync(smipath, smiFile);

			res.render('arrange-success', {
				originalMovie: spath,
				originalSmi: smipath,
				newMovie: movieFile,
				newSmi: smiFile,
				error: ''
			});
		}

	} else {
		fs.readdir(spath, function(err, files) {
			var dirList = [];
			var fileList = [];

			console.log('# file count : ' + files.length);
			for(var i=0; i<files.length; i++) {
				var file = files[i];
				var fullpath = spath + '/' + files[i];
				var stat = fs.statSync(fullpath);
				if(!stat.isFile() && !stat.isDirectory()) continue;

				var f = {
					isDirectory: stat.isDirectory(),
					extension: getExtension(files[i]).toLowerCase(),
					file: file,
					path: fullpath,
					mode: mode
				};
				if(mode == 'smi') {
					if(!f.isDirectory && smiExtensions.indexOf(f.extension) == -1) continue;
				} else if(mode == 'movie') {
					if(!f.isDirectory && movieExtensions.indexOf(f.extension) == -1) continue;
				}

				console.log('# ' + file);

				if(f.isDirectory) dirList[dirList.length] = f;
				else fileList[fileList.length] = f;
			}

			var list = dirList.concat(fileList);
			if(spath != global.download_path) {
				list.unshift({
					isDirectory: true,
					extension: '',
					file: '..',
					path: getParentPath(spath),
					mode: mode
				});
				list.unshift({
					isDirectory: true,
					extension: '',
					file: '/',
					path: global.download_path,
					mode: mode
				});
			}
			
			res.render('arrange', {
				files: list,
				mode: mode,
				smipath: smipath,
				currentpath: spath
			});
		});
	}
});

router.use('/download', function (req, res, next) {
	var transmission = app.get('transmission');
	var loader = app.get('engine_loader');

	var engine = loader.get(req.query['engine']||req.session['engine']);
	var value = req.query['value'];
	var title = req.query['title'];
	var group = req.query['group'];
	//console.log(value);
	//console.log(title);

	var locals = {
		engine: {
			name: engine.name,
			host: engine.host,
		},
		alertmsg: '',
		results: [],
	};

	var groupdir = global.download_path;
	if (group) {
		groupdir += '/'+group.replace(/[^가-힣a-zA-Z0-9. \[\]\(\)\-_]/g, '').replace(/[.]+$/g, '').replace(/[ ]+/g, ' ').trim();
	}
	var downdir = groupdir+'/'+title.replace(/[^가-힣a-zA-Z0-9. \[\]\(\)\-_]/g, '').replace(/[.]+$/g, '').replace(/[ ]+/g, ' ').trim();

	function process(files) {
		async.eachSeries(files, function(file, next) {
			var item = {
				file: file.file,
				name: file.name,
				ext: path.extname(file.name).toLowerCase()
			};
			if (!fs.existsSync(item.file)) {
				locals.alertmsg += '<strong>'+item.name+'</strong>'+item.file+' not exists <br/>';
				return next();
			}
			if (item.ext=='.torrent') {
				transmission.addFile(item.file, {'download-dir':downdir}, function(err, arg) {
					try {
						console.log('#delete#'+item.file);
						fs.unlinkSync(item.file);
					} catch (e) {
						console.log(e.message);
					}

					if (err) {
						console.log(err);
						locals.alertmsg += '<strong>'+item.name+'</strong> '+err.result+'<br/>';
						return next();
					}

					locals.results.push(item);
					next();
				});
			} else {
				if (!item.name) {
					item.name = 'undefined';
				}
				fs.renameSync(item.file, downdir + '/' + item.name);
				locals.results.push(item);
				next();
			}
		}, function() {
			res.render('download', locals);
		});
	}

	if (!value) {
		res.render('download', locals);
		return;
	}

	engine.download(value, title, function(err, ret) {
		console.log('complete');

		if (err) {
			locals.alertmsg = ret;
		}

		if (ret.meesage) {
			locals.alertmsg += ret.meesage;
		}
		
		if (ret.files) {
			console.log(ret.files);
			try {
				mkdirp(downdir, 0777, function(err) {
					if (err) {
						console.error(err);
						locals.alertmsg += util.inspect(err);
						res.render('download', locals);
						return;
					}
					fs.chmodSync(groupdir, 0777);
					fs.chmodSync(downdir, 0777);
					process(ret.files);
				});
			} catch(e) {
				if (e.code != 'EEXIST') throw e;
				console.log(e.message);
				res.render('download', locals);
			}
		}
	});
});

router.use('/torrent', function (req, res, next) {
	var transmission = app.get('transmission');

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
	var transmission = app.get('transmission');

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
	var transmission = app.get('transmission');

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

router.use('/search-image', function (req, res) {
	var query = req.query['query'];
	var start = req.query['start'];
	if (!start) start = 0;
	var url = 'http://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' + encodeURIComponent(query) + '&start=' + start;

	(function(callback) {
		var request = http.request(url, function(response) {
			response.setEncoding('utf8');
			var data = '';
			response.on('data', function (chunk) {
				data += chunk;
			});
			response.on('end', function() {
				callback(false, data);
			});
		});
		request.on('error', function(e) {
			console.log('problem with request: ' + e.message);
			console.log(e);
			callback(-1, 'problem with request: ' + e.message);
		});
		request.on('socket', function (socket) {
			socket.setTimeout(15*1000);  
			socket.on('timeout', function() {
				request.abort();
				callback(-1, 'socket timeout');
			});
		});
		request.end();
	})(function(err, body) {
		if (err) {
			res.json({
				success:false,
				message:body
			});
			return;
		}
		try {
			var result = JSON.parse(body);
			var items = result.responseData.results;
			res.json({
				success:true,
				items:items
			});
		} catch (e) {
			console.error(e);
			res.json({sucess:false,message:body});
		}
	});

});


router.get('/', function(req, res, next) {
	var scheduler = app.get('scheduler');
	var loader = app.get('engine_loader');

	if (req.query['engine']) {
		req.session['engine'] = req.query['engine'];
	}

	var engine = loader.get(req.session['engine']);
	var engines = loader.all();

	res.render('index', {
		engines: engines,
		engine: engine,
		schedules: scheduler.list(),
	});
});

module.exports = router;
