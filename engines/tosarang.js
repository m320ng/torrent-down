var SimpleEngine = require('../simple-engine');

module.exports = {
	get: function() {
		return new SimpleEngine({
			name: 'tosarang',
			host: 'www.tosarang.net',
			typelist: {
				'torrent_movie_kor': '한국영화',
				'torrent_movie_eng': '외국영화',
				'torrent_kortv_ent': '한국예능',
				'torrent_kortv_social': '한국시사',
				'torrent_kortv_drama': '한국드라마',
				'torrent_engtv_ent': '외국예능',
				'torrent_engtv_social': '외국시사',
				'torrent_engtv_drama': '외국드라마',
				'torrent_video_sports': '스포츠',
				'torrent_video_ani': '애니메이션',
				'torrent_music_kor': '한국음악',
				'torrent_music_eng': '외국음악',
			},
			mapping: {
			},
			search_path: function(opt) {
				var path = '/bbs/board.php?bo_table={type}&sca=&sfl=wr_subject&stx={keyword}&sop=and&page={page}';
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
