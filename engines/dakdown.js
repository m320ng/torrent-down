var SimpleEngine = require('../simple-engine');
var encode = require('../http-client.js').encode;

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'dakdown',
			host: 'dakdown.net',
			charset: 'euc-kr',
			typelist: {
				'movie': '영화',
				'kortv': '한국TV',
				'fortv': '외국TV',
				'ani': '애니메이션',
				'music': '음악',
				'book': '도서',
				'smi': '자막',
			},
			mapping: {
				'한국예능': 'kortv',
				'한국시사': 'kortv',
			},
			search_path: function(opt) {
				var path = '/bbs/board.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&sop=and&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				return path;
			},
			search_filter: function($body) {
			},
			listlink_match: 'a',
			listlink_filter: function($link, opt) {
				var href = $link.attr('href');
				//console.log(href);
				if (href && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+opt.type)!=-1) {
					return {
						link: href.substring(2),
						title: $link.text(),
						info: 'http://'+this.host+href.substring(2),
					};
				}
				return null;
			},
			download_match: 'a',
			download_filter: function($link) {
				var href = $link.attr('href');
				if (href && href.indexOf('javascript:file_download')!=-1) {
					var matches = href.match(/'([^']+)'/gm);
					var filelink = matches[0].substring(1, matches[0].length - 1);
					var filename = matches[1].substring(1, matches[1].length - 1);
					filelink = '/bbs'+filelink.substring(1);
					filename = unescape(filename.replace(/\+/g, '%20'));
					filename = encode(new Buffer(filename, 'binary'), 'euc-kr', 'utf8');
					return {
						link: filelink,
						name: filename, //optional
					};
				}
				return null;
			},
		});
	}
}
