var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'torrentdada',
			host: 'www.torrentdada.com',
			typelist: {
				'TV_Variety': '예능',
				'TV_Docu': '시사교양',
				'TV_Drama': '드라마',
				'Movie_01': '해외영화',
				'Movie_02': '국내영화',
				'MP3': '음악',
				'Anime': '애니',
			},
			mapping: {
				'한국예능': 'TV_Variety',
				'한국시사': 'TV_Docu',
			},
			search_path: function(opt) {
				var path = '/?_filter=search&act=&vid=&mid={type}&category=&search_target=title&search_keyword={keyword}&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				return path;
			},
			search_filter: function($body) {
				$body('#hot_list').remove(); // 인기게시물제거
			},
			listlink_match: 'a',
			listlink_filter: function($link, opt) {
				var href = $link.attr('href');
				var text = $link.text();
				//console.log(href);
				if (href && /document_srl\=[0-9]+/.test(href) && href.indexOf('mid='+opt.type)!=-1) {
					href = href.replace(/&amp;/g,'&');
					return {
						link: href,
						title: text.replace(/[\t\n\r]/g,''),
						info: 'http://'+this.host+href,
					};
				}
				return null;
			},
			download_match: 'a',
			download_filter: function($link) {
				//console.log(href);
				var href = $link.attr('href');
				if (href && href.indexOf('module=file')!=-1 && /file_srl\=[0-9]+/.test(href)) {
					href = href.replace(/&amp;/g,'&');
					var filelink = href;
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
