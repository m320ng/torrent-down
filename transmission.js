var path = require('path');
var fs = require('fs');

/* torrent
 ------------------------------------------------------------------------------------ */
var Transmission = require('transmission');
var transmission = new Transmission({
    host: 'localhost',
    port: 9091,
	username: 'transmission',
	password: 'transmission',
});
transmission.methods.torrents.fields = ['hashString','name','status','percentDone','startDate','downloadDir'];

// 정리
setInterval(function() {
	var transmission = app.get('transmission');
	//console.log(transmission.methods.torrents.fields);
	transmission.get(function(err, result) {
		if (!err) {
			result.torrents.forEach(function(torrent) {
				if (torrent.status==0 && torrent.percentDone==1) {
					if (torrent.downloadDir.indexOf(global.download_path+'/')!=-1) {
						console.log(torrent.name);
						var smifiles = [];
						var movfiles = [];
						var rootdir = torrent.downloadDir;
						var recursive = function(dir) {
							var files = fs.readdirSync(dir);
							files.forEach(function(file) {
								var fulldir = dir + '/' + file;
								var stat = fs.statSync(fulldir);
								if (stat.isDirectory()) {
									recursive(fulldir);
									return;
								}
								var ext = path.extname(file);
								if (ext=='.smi') {
									smifiles.push(file);
								} else if (ext=='.scr') {
									console.log(file + ' 바이러스 의심 삭제.');
									fs.unlinkSync(fulldir);
									return;
								} else if ('.avi,.mkv,.wmv,.mp4'.indexOf(ext)!=-1 && stat.size > 60 * 1000 * 1000) {
									movfiles.push(file);
								}
								fs.renameSync(fulldir, rootdir + '/' + file);
							});
						}
						recursive(rootdir);
						if (smifiles.length==1 && movfiles.length==1) {
							var smi_base = path.basename(smifiles[0]);
							var mov_ext = path.extname(movfiles[0]);
							var newname = smi_base+mov_ext;
							fs.renameSync(rootdir + '/' + movfiles[0], rootdir + '/' + newname);
						} else {
							//for (var i=0; i<smifiles.length; i++) {
							//	var smifile = smifiles[i];
							//}
						}
						transmission.remove(torrent.hashString, false, function(err, result) {
							console.log('removed');
						});
					}
				}
			});
		}
	});
}, 15000);

module.exports = transmission;
