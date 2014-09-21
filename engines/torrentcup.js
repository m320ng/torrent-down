var cheerio = require("cheerio");
var async = require('async');
var engine = require('../engine');

var name = 'torrentcup';
var host = 'www.torrentcup.net';
var typelist = {
	'all': '전체검색',
	'torrent_movie': '영화',
	'torrent_tv': 'TV드라마',
	'torrent_variety': 'TV예능',
	'torrent_docu': '다큐/시사',
	'torrent_mid': '미드',
	'torrent_sports': '스포츠',
	'torrent_ani': '애니',
};
var mapping = {
};

var Engine = module.exports = function() {
	var navi = engine.http();
	this.name = name;
	this.typelist = typelist;
	this.mapping = mapping;

	this.verify = function(callback) {
		var self = this;
		navi.head(host, '/', function(err) {
			if (err) {
				console.log('['+name+'] error');
			} else {
				console.log('['+name+'] verify');
				self.enable = true;
			}
			callback(err);
		});
	};

	this.search = function(type, keyword, page, callback) {
		console.log('['+name+'] search');
		var path = '/bbs/cache.php?bo_table='+type+'&sca=&sfl=wr_subject&stx='+engine.urlencode(keyword, 'utf-8')+'&sop=and';
		if (page && page > 1) path += '&page=' + page;
		if (type=='all') {
			path = '/bbs/s.php?q=&k='+engine.urlencode(keyword, 'utf-8');
		}
		//console.log(path);
		navi.get(host, path, 'utf-8', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			$('fieldset').remove(); // 인기게시물제거

			var result = [];
			var skip = {};
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && /wr_id\=[0-9]+/.test(href)) {
					if (!skip[href.substring(2)]) {
						skip[href.substring(2)] = $(this).text();
					} else {
						if ($(this).text().length > skip[href.substring(2)].length) {
							skip[href.substring(2)] = $(this).text();
						}
					}
				}
			});
			for (var k in skip) {
				result.push({
					value:k,
					title:skip[k],
					info: 'http://'+host+k,
				});
			}

			callback(false, result);
		});
	};

	this.download = function(value, name, callback) {
		navi.get(host, value, 'utf-8', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});

			name = name.replace(/[^가-힣a-zA-Z0-9. \[\]\-_]/g, '');

			var tasks = [];
			var filenames = [];
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && href.indexOf('javascript:file_download')!=-1) {
					var matches = href.match(/'([^']+)'/gm);
					var filelink = matches[0].substring(1, matches[0].length - 1);
					filelink = '/bbs'+filelink.substring(1);
					var index = tasks.length;
					//name = $(this).text();
					//console.log(filelink);
					tasks.push(function(next) {
						navi.download(host, filelink, '', 'utf-8', function(err, filename) {
							console.log(filename + ' saved');
							filenames.push(filename);
							next();
						});
					});
				}
			});
			async.parallel(tasks, function() {
				callback(false, filenames);
			});

		});
	};

	return this;
};

Engine.get = function() {
	return new Engine();
};