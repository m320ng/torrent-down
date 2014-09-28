var async = require('async')
var path = require('path');
var fs = require('fs');

var schedules = require(path.join(__dirname,'schedule'));
//var schedulesQue = [];

function downloadProcess(target) {
	var transmission = app.get('transmission');
	var loader = app.get('engine_loader');

	console.log('자동 다운로드 시작');
	console.log(target);

	var tasks = [];
	loader.all().forEach(function(engine) {
		if (engine.enable && engine.mapping) {
			var type = engine.mapping[target.type];
			if (type) {
				tasks.push(function(next) {
					engine.search(type, target.keyword, 1, function(err, result) {
						if (err) {
							console.log(err);
							console.log(result);
							next();
							return;
						}
						if (!result || !result.length) {
							next();
							return;
						}
						var select = result[0];
						result.forEach(function (item) {
							if (item.title.indexOf(item.relname)!=-1) {
								select = item;
								return;
							}
						});

						var value = select.value; 
						var title = select.title;
						engine.download(value, title, function(err, ret) {
							if (err) {
								console.log(err);
								console.log(ret);
								next();
								return;
							}

							if (ret.meesage) {
								console.log(ret.meesage);
							}
							
							if (ret.files) {
								var downdir = global.download_path+'/'+title.replace(/[^가-힣a-zA-Z0-9. \[\]\-_]/g, '').replace(/[.]+$/g, '').replace(/[ ]+/g, ' ').trim();
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
									console.log(item);
								});
							}
							console.log('schedule download complete');
						});
					});
				});
			}
		}
	});
	
	console.log('tasks: '+tasks.length);
	async.series(tasks, function() {
		console.log('자동 다운로드 끝');
	});
}

var que = {};
var scheduleProcessTimer = null;
function scheduleProcess() {
	console.log('schedule-process');
	var now = new Date();
	schedules.forEach(function(item, index) {
		if (item.type=='매주' && item.week==now.getDay()) {
			var remainMin = (item.hour * 60 + item.minute) - (now.getHours() * 60 + now.getMinutes());

			if (remainMin > 0 && remainMin <= 90) {
				var key = [item.type,item.hour,item.mminute,item.title].join('_');
				if (que[key]) return;
				que[key] = true;
				console.log(item.title + ' ' + remainMin + '분후에 다운로드 시작');
				setTimeout(function() {
					downloadProcess(item.target, index);
					delete que[key];
				}, remainMin * 60 * 1000);
			}
		}
	});

	var perHourTick = 60 * 60;

	scheduleProcessTimer = setTimeout(function() {
		scheduleProcess();
	}, perHourTick * 1000);
}

// 설정파일 주시
fs.watchFile(path.join(__dirname,'schedule.js'), function(curr, prev) {
	console.log('watch-file :' + path.join(__dirname,'schedule.js'));
	delete require.cache[path.join(__dirname,'schedule.js')];
	schedules = require(path.join(__dirname,'schedule'));

	// 스케쥴 시작
	console.log('scheduler restart');
	if (scheduleProcessTimer) clearTimeout(scheduleProcessTimer);
	scheduleProcess();
});

module.exports = {
	process: function() {
		if (scheduleProcessTimer) clearTimeout(scheduleProcessTimer);
		scheduleProcess();
	},
	list: function() {
		return schedules;
	}
}
