var cheerio = require("cheerio");
var async = require('async');
var engine = require('../engine');

var name = 'wonzo';
var host = 'wonzo1.onmypc.net';
var typelist = {
	'torrent_movie': '영화',
	'torrent_drama': '드라마',
	'torrent_ent': '예능/오락',
	'torrent_tv': 'TV프로',
	'torrent_ani': '애니메이션',
	'torrent_music': '음악',
};
var mapping = {
	'한국예능': 'torrent_tv',
	'한국시사': 'torrent_ent',
};

var Engine = module.exports = function() {
	var navi = engine.http();
	this.name = name;
	this.typelist = typelist;
	this.mapping = mapping;

	this.verify = function(callback) {
		var self = this;
		navi.head(host, '/bbs/login.php', function(err) {
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
		var path = '/bbs/board.php?bo_table='+type+'&sca=&sfl=wr_subject&stx='+engine.urlencode(keyword, 'utf-8')+'&sop=and';
		if (page && page > 1) path += '&page=' + page;
		//console.log(path);
		navi.get(host, path, 'utf-8', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			$('fieldset').remove();

			var result = [];
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+type)!=-1) {
					var val = href.substring('http://wonzo1.onmypc.net'.length).replace(/&amp;/g, '&');
					result.push({
						value: val,
						title: $(this).text(),
						info: 'http://'+host+val,
					});
				}
			});

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
				if (href && href.indexOf('download.php')!=-1 && /wr_id\=[0-9]+/.test(href)) {
					console.log(href);
					var filelink = href.substring('http://wonzo1.onmypc.net'.length).replace(/&amp;/g, '&');
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