var util = require('util');
var fs = require('fs');
var path = require('path')
var async = require('async')
var express = require('express');
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

	if (value) {
		engine.download(value, title, function(err, ret) {
			//console.log('complete');

			if (err) {
				locals.alertmsg = ret;
			}

			if (ret.meesage) {
				locals.alertmsg += ret.meesage;
			}
			
			if (ret.files) {
				var downdir = global.download_path+'/'+title.replace(/[^가-힣a-zA-Z0-9. \[\]\-_]/g, '').replace(/[.]+$/g, '').replace(/[ ]+/g, ' ').trim();
				//console.log(downdir);
				try {
					fs.mkdirSync(downdir, 0777);
					fs.chmodSync(downdir, 0777);
				} catch(e) {
					if (e.code != 'EEXIST') throw e;
				}

				ret.files.forEach(function(file) {
					var item = {
						file: file.file,
						name: file.name,
						ext: path.extname(file.name).toLowerCase()
					};
					if (item.ext=='.torrent') {
						//fs.rename(item.file, '/data/torrent/' + item.name);
						transmission.addFile(item.file, {'download-dir':downdir}, function(err, arg) {
							if (err) {
								//console.log(arg);
								locals.alertmsg += util.inspect(arg);
								return;
							}
							//console.log(arg);
							try {
								fs.unlinkSync(item.file);
							} catch (e) {}
						});
					} else {
						if (!item.name) {
							item.name = 'undefined';
						}
						fs.renameSync(item.file, downdir + '/' + item.name);
					}
					locals.results.push(item);
				});
			}

			res.render('download', locals);
		});
	} else {
		res.render('download', locals);
	}
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
