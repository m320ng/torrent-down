var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'torrentgogo',
			host: 'torrentgogo.net',
			typelist: {
				'B06': '영화',
				'B07': '고화질',
				'B23': 'TV드라마',
				'B24': 'TV예능',
				'B25': '다큐/시사',
				'B13': '애니',
			},
			mapping: {
				'한국예능': 'B24',
				'한국시사': 'B25',
				'한국드라마': 'B23',
			},
			search_path: function(opt) {
				var path = '/bbs/board.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&sop=and&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				return path;
			},
			search_filter: function($body) {
				$body('#mw_basic_hot_list').remove(); // 인기게시물제거
			},
			listlink_match: 'a',
			listlink_filter: function($link, opt) {
				var href = $link.attr('href');
				var text = $link.text();
				//console.log(href);
				if (href && text.length > 5 && /wr_id\=[0-9]+/.test(href) && href.indexOf('bo_table='+opt.type)!=-1) {
					return {
						link: href.substring(2),
						title: text,
						info: 'http://'+this.host+href.substring(2),
					};
				}
				return null;
			},
			download_match: 'a',
			download_filter: function($link) {
				//console.log(href);
				var href = $link.attr('href');
				if (href && href.indexOf('javascript:file_download')!=-1) {
					var matches = href.match(/'([^']+)'/gm);
					var filelink = matches[0].substring(1, matches[0].length - 1);
					filelink = '/bbs'+filelink.substring(1);
					//console.log(matches);
					//console.log(filelink);
					return {
						link: filelink
					};
				}
				return null;
			},
		});
	}
}
