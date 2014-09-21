var cheerio = require("cheerio");
var async = require('async');
var engine = require('../engine');

var name = 'torrenters';
var host = 'torrenters.com';
var typelist = {
	'tr_pbtv': 'TV방송',
	'tr_ftv': '외국TV',
	'tr_kmovie': '국내영화',
	'tr_fmovie': '외국영화',
	'tr_ani': '애니',
	'tr_video': '영상',
	'tr_sports': '스포츠',
};
var mapping = {
	'한국예능': 'tr_pbtv',
	'한국시사': 'tr_pbtv',
};

var Engine = module.exports = function() {
	var navi = engine.http();
	this.name = name;
	this.typelist = typelist;

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
		var path = '/bbs/board.php?bo_table='+type+'&sca=&sfl=wr_subject&stx='+engine.urlencode(keyword, 'utf-8');
		if (page && page > 1) path += '&page=' + page;
		console.log(path);
		navi.get(host, path, 'utf-8', function(err, body) {
			var $ = cheerio.load(body, {
				decodeEntities: false
			});
			$('#hot_list').remove(); // 인기게시물제거

			var result = [];
			$('a').each(function() {
				var href = $(this).attr('href');
				if (href && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+type)!=-1) {
					var val = href.substring(2);
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
				if (href && href.indexOf('javascript:dnload')!=-1) {
					var matches = href.match(/'([^']+)'/gm);
					var filelink = matches[0].substring(1, matches[0].length - 1);
					filelink = '/bbs'+filelink.substring(1);
					var index = tasks.length;
					console.log(filelink);
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