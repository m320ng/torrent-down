var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'torrent82',
			host: 'www.torrent82.com',
			typelist: {
				'torrent_movie': '영화',
				'torrent_variety': '예능',
				'torrent_drama': '드라마',
				'torrent_sports': '스포츠',
				'torrent_docu': '다큐/시사',
				'torrent_mid': '해외TV',
				'torrent_ani': '애니메이션',
				'torrent_music': '음악',
			},
			mapping: {
				'한국예능': 'torrent_variety',
				'한국시사': 'torrent_docu',
				'한국드라마': 'torrent_drama',
			},
			search_path: function(opt) {
				var path = '/bbs/board.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&sop=and&page={page}';
				path = path.replace(/\{type\}/g, opt.type);
				path = path.replace(/\{keyword\}/g, opt.keyword);
				path = path.replace(/\{page\}/g, opt.page);
				return path;
			},
			search_filter: function($body) {
				$body('div.sub_best_down').remove(); // 인기게시물제거
			},
			listlink_match: 'a',
			listlink_filter: function($link, opt) {
				var href = $link.attr('href');
				var text = $link.text().replace(/&nbsp;/g, ' ').trim();
				//console.log(href);
				if (href && text.length > 5 && /wr_id\=[0-9]+/.test(href) && !/^[0-9.GMB]+$/.test(text) && href.indexOf('bo_table='+opt.type)!=-1) {
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
