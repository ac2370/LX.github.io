/* ============================================================
   music-player.js —— 主页黑胶唱片播放器
   挂载：window.playlist, window.openPlaylistSheet,
         window.playSong, window.getCurrentSong
   ============================================================ */
(function () {
  'use strict';

  // ==================== DOM ====================
  var audio        = document.getElementById('audioPlayer');
  var songTitle    = document.getElementById('songTitle');
  var songArtist   = document.getElementById('songArtist');
  var playBtn      = document.getElementById('playBtn');
  var playIcon     = document.getElementById('playIcon');
  var prevBtn      = document.getElementById('prevBtn');
  var nextBtn      = document.getElementById('nextBtn');
  var vinylCover   = document.getElementById('vinylCover');
  var uploadBtn    = document.getElementById('uploadBtn');

  var playlistSheet = document.getElementById('playlistSheet');
  var playlistScroll = document.getElementById('playlistScroll');
  var openManageBtn  = document.getElementById('openManageBtn');
  var searchSongBtn  = document.getElementById('searchSongBtn');
  var openAddBtn     = document.getElementById('openAddBtn');

  var addModal   = document.getElementById('addModal');
  var addTitle   = document.getElementById('addTitle');
  var addArtist  = document.getElementById('addArtist');
  var addUrl     = document.getElementById('addUrl');
  var addCancel  = document.getElementById('addCancel');
  var addConfirm = document.getElementById('addConfirm');

  var manageModal       = document.getElementById('manageModal');
  var importPlaylistBtn = document.getElementById('importPlaylistBtn');
  var exportPlaylistBtn = document.getElementById('exportPlaylistBtn');
  var importFileInput   = document.getElementById('importFileInput');
  var manageCancel      = document.getElementById('manageCancel');

  // 若核心节点不存在，直接退出，避免在其它页面报错
  if (!audio || !playBtn || !vinylCover || !playlistSheet) return;

  // ==================== 数据 ====================
  var playlist = [
    {
      title: 'My love',
      artist: '颜人中',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      cover: 'https://picsum.photos/100/100?random=20',
      lyric: '我的爱 像风一样 来了又走'
    },
    {
      title: '夜曲',
      artist: '周杰伦',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      cover: 'https://picsum.photos/100/100?random=21',
      lyric: '一群嗜血的蚂蚁 被腐肉所吸引'
    },
    {
      title: '晴天',
      artist: '周杰伦',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      cover: 'https://picsum.photos/100/100?random=22',
      lyric: '故事的小黄花 从出生那年就飘着'
    },
    {
      title: '起风了',
      artist: '买辣椒也用券',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      cover: 'https://picsum.photos/100/100?random=23',
      lyric: '这一路上走走停停 顺着少年漂流的痕迹'
    }
  ];

  var currentSongIndex = 0;
  var isPlaying = false;

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ==================== 歌单渲染 ====================
  function renderPlaylistSheet() {
    if (!playlistScroll) return;
    playlistScroll.innerHTML = '';
    playlist.forEach(function (song, index) {
      var row = document.createElement('div');
      row.className = 'song-row' + (index === currentSongIndex ? ' current' : '');
      row.innerHTML =
        '<div class="song-row-info">' +
          '<div class="song-row-title">' + escapeHtml(song.title) + '</div>' +
          '<div class="song-row-artist">' + escapeHtml(song.lyric || song.artist) + '</div>' +
        '</div>' +
        '<div class="song-row-radio"></div>';
      row.addEventListener('click', function () {
        currentSongIndex = index;
        playSong(index);
        closePlaylistSheet();
      });
      playlistScroll.appendChild(row);
    });
  }

  function openPlaylistSheet() {
    renderPlaylistSheet();
    playlistSheet.classList.add('active');
  }
  function closePlaylistSheet() {
    playlistSheet.classList.remove('active');
  }

  // ==================== 播放控制 ====================
  function playSong(index) {
    if (index < 0 || index >= playlist.length) return;
    var song = playlist[index];

    audio.src = song.url;
    if (songTitle)  songTitle.textContent  = song.title;
    if (songArtist) songArtist.textContent = song.artist;

    if (song.cover) {
      var albumCover = document.getElementById('albumCover');
      var albumIcon  = document.getElementById('albumIcon');
      if (albumCover) {
        albumCover.src = song.cover;
        albumCover.style.display = 'block';
      }
      if (albumIcon) albumIcon.style.display = 'none';
    }

    audio.play().then(function () {
      isPlaying = true;
      if (playIcon) {
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
      }
      vinylCover.classList.add('spinning');
    }).catch(function () {
      isPlaying = false;
      if (playIcon) {
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
      }
      vinylCover.classList.remove('spinning');
    });

    renderPlaylistSheet();
  }

  // ==================== 事件绑定 ====================
  playBtn.addEventListener('click', function () {
    if (!audio.src) {
      playSong(currentSongIndex);
      return;
    }
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      if (playIcon) {
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
      }
      vinylCover.classList.remove('spinning');
    } else {
      audio.play().then(function () {
        isPlaying = true;
        if (playIcon) {
          playIcon.classList.remove('fa-play');
          playIcon.classList.add('fa-pause');
        }
        vinylCover.classList.add('spinning');
      }).catch(function () {});
    }
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', function () {
      currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
      playSong(currentSongIndex);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      currentSongIndex = (currentSongIndex + 1) % playlist.length;
      playSong(currentSongIndex);
    });
  }

  audio.addEventListener('ended', function () {
    if (nextBtn) nextBtn.click();
  });

  // 点击黑胶打开歌单
  vinylCover.addEventListener('click', openPlaylistSheet);
  playlistSheet.addEventListener('click', function (e) {
    if (e.target === playlistSheet) closePlaylistSheet();
  });

  // ==================== 添加歌曲 ====================
  function openAddModal() {
    if (addTitle)  addTitle.value  = '';
    if (addArtist) addArtist.value = '';
    if (addUrl)    addUrl.value    = '';
    addModal.classList.add('active');
  }
  function closeAddModal() {
    addModal.classList.remove('active');
  }

  if (uploadBtn) {
    uploadBtn.addEventListener('click', function () { openAddModal(); });
  }
  if (openAddBtn) {
    openAddBtn.addEventListener('click', function () {
      closePlaylistSheet();
      openAddModal();
    });
  }
  if (addCancel) addCancel.addEventListener('click', closeAddModal);
  if (addModal) {
    addModal.addEventListener('click', function (e) {
      if (e.target === addModal) closeAddModal();
    });
  }

  if (addConfirm) {
    addConfirm.addEventListener('click', function () {
      var title  = (addTitle  && addTitle.value.trim())  || '未命名歌曲';
      var artist = (addArtist && addArtist.value.trim()) || '未知歌手';
      var url    = (addUrl    && addUrl.value.trim())    || '';
      if (!url) { alert('请填写音频链接'); return; }

      playlist.push({
        title: title,
        artist: artist,
        url: url,
        cover: 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000),
        lyric: artist
      });
      currentSongIndex = playlist.length - 1;
      playSong(currentSongIndex);
      closeAddModal();
      closePlaylistSheet();
    });
  }

  // ==================== 歌单管理 ====================
  if (openManageBtn) {
    openManageBtn.addEventListener('click', function () {
      if (manageModal) manageModal.classList.add('active');
    });
  }
  if (manageCancel) {
    manageCancel.addEventListener('click', function () {
      if (manageModal) manageModal.classList.remove('active');
    });
  }
  if (manageModal) {
    manageModal.addEventListener('click', function (e) {
      if (e.target === manageModal) manageModal.classList.remove('active');
    });
  }

  if (importPlaylistBtn) {
    importPlaylistBtn.addEventListener('click', function () {
      if (importFileInput) importFileInput.click();
    });
  }
  if (importFileInput) {
    importFileInput.addEventListener('change', function () {
      var file = importFileInput.files && importFileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var content = e.target.result;
          var imported = [];
          try {
            var parsed = JSON.parse(content);
            if (Array.isArray(parsed)) imported = parsed;
            else if (parsed && Array.isArray(parsed.songs)) imported = parsed.songs;
          } catch (err) {
            imported = content.split('\n').filter(function (l) { return l.trim(); }).map(function (line) {
              var parts = line.split('|').map(function (p) { return p.trim(); });
              return { title: parts[0] || '未命名', artist: parts[1] || '未知', url: parts[2] || '' };
            }).filter(function (s) { return s.url; });
          }
          var valid = imported.filter(function (s) { return s && s.url; }).map(function (s) {
            return {
              title: s.title || '未命名歌曲',
              artist: s.artist || '未知歌手',
              url: s.url,
              cover: s.cover || 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000),
              lyric: s.lyric || s.artist || ''
            };
          });
          if (valid.length === 0) { alert('未找到有效歌曲'); return; }
          playlist = playlist.concat(valid);
          renderPlaylistSheet();
          alert('成功导入 ' + valid.length + ' 首歌曲');
        } catch (err) {
          alert('导入失败');
        }
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  if (exportPlaylistBtn) {
    exportPlaylistBtn.addEventListener('click', function () {
      var data = JSON.stringify({ songs: playlist }, null, 2);
      var blob = new Blob([data], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'playlist.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (manageModal) manageModal.classList.remove('active');
    });
  }

  // ==================== 搜索 ====================
  if (searchSongBtn) {
    searchSongBtn.addEventListener('click', function () {
      var keyword = prompt('搜索歌曲名称：');
      if (keyword) {
        var found = playlist.findIndex(function (s) { return s.title.indexOf(keyword) >= 0; });
        if (found >= 0) {
          currentSongIndex = found;
          playSong(found);
          closePlaylistSheet();
        } else {
          alert('未找到匹配的歌曲');
        }
      }
    });
  }

  // ==================== 初始化显示第一首 ====================
  if (playlist.length > 0) {
    if (songTitle)  songTitle.textContent  = playlist[0].title;
    if (songArtist) songArtist.textContent = playlist[0].artist;
    audio.src = playlist[0].url;

    var albumCover0 = document.getElementById('albumCover');
    var albumIcon0  = document.getElementById('albumIcon');
    if (playlist[0].cover) {
      if (albumCover0) {
        albumCover0.src = playlist[0].cover;
        albumCover0.style.display = 'block';
      }
      if (albumIcon0) albumIcon0.style.display = 'none';
    }
  }

  // ==================== 挂载到 window ====================
  window.playlist          = playlist;
  window.openPlaylistSheet = openPlaylistSheet;
  window.playSong          = playSong;
  window.getCurrentSong    = function () {
    if (currentSongIndex >= 0 && currentSongIndex < playlist.length) {
      return playlist[currentSongIndex];
    }
    return null;
  };

})();
