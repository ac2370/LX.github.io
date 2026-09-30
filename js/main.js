/**
 * 主页主逻辑（图片切换、音乐播放、设置面板等）
 * 依赖：message.js 中的 initMessageApp()
 */

(function () {
  'use strict';

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // ==================== 图片自定义逻辑 ====================
  const openBtn = document.getElementById('openSettings');
  const modal = document.getElementById('settingsModal');
  const closeBtn = document.getElementById('closeSettings');
  const cancelBtn = document.getElementById('cancelSettings');
  const confirmBtn = document.getElementById('confirmSettings');

  const objectUrls = { bg: null, avatar: null, photo1: null, photo2: null, photo3: null, album: null, music: null };

  const inputBg = document.getElementById('inputBg');
  const inputAvatar = document.getElementById('inputAvatar');
  const inputPhoto1 = document.getElementById('inputPhoto1');
  const inputPhoto2 = document.getElementById('inputPhoto2');
  const inputPhoto3 = document.getElementById('inputPhoto3');
  const inputAlbum = document.getElementById('inputAlbum');
  const inputMusicUrl = document.getElementById('inputMusicUrl');

  const fileBg = document.getElementById('fileBg');
  const fileAvatar = document.getElementById('fileAvatar');
  const filePhoto1 = document.getElementById('filePhoto1');
  const filePhoto2 = document.getElementById('filePhoto2');
  const filePhoto3 = document.getElementById('filePhoto3');
  const fileAlbum = document.getElementById('fileAlbum');
  const fileMusic = document.getElementById('fileMusic');

  const nameBg = document.getElementById('nameBg');
  const nameAvatar = document.getElementById('nameAvatar');
  const namePhoto1 = document.getElementById('namePhoto1');
  const namePhoto2 = document.getElementById('namePhoto2');
  const namePhoto3 = document.getElementById('namePhoto3');
  const nameAlbum = document.getElementById('nameAlbum');
  const nameMusic = document.getElementById('nameMusic');

  const bgDream = document.getElementById('bgDream');
  const avatarImg = document.getElementById('avatarImg');
  const photo1 = document.getElementById('photo1');
  const photo2 = document.getElementById('photo2');
  const photo3 = document.getElementById('photo3');
  const albumCover = document.getElementById('albumCover');
  const albumIcon = document.getElementById('albumIcon');

  const currentImages = {
    bg: 'https://picsum.photos/1200/1800?random=10',
    avatar: 'https://picsum.photos/100/100?random=1',
    photo1: 'https://picsum.photos/200/200?random=2',
    photo2: 'https://picsum.photos/200/200?random=3',
    photo3: 'https://picsum.photos/200/200?random=4',
    album: null,
    music: null
  };

  function openModal() {
    inputBg.value = currentImages.bg || '';
    inputAvatar.value = currentImages.avatar || '';
    inputPhoto1.value = currentImages.photo1 || '';
    inputPhoto2.value = currentImages.photo2 || '';
    inputPhoto3.value = currentImages.photo3 || '';
    inputAlbum.value = currentImages.album || '';
    inputMusicUrl.value = currentImages.music || '';
    nameBg.textContent = '未选择文件';
    nameAvatar.textContent = '未选择文件';
    namePhoto1.textContent = '未选择文件';
    namePhoto2.textContent = '未选择文件';
    namePhoto3.textContent = '未选择文件';
    nameAlbum.textContent = '未选择文件';
    nameMusic.textContent = '未选择文件';
    modal.classList.add('active');
  }
  function closeModal() { modal.classList.remove('active'); }

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  function handleFile(input, nameSpan) {
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      nameSpan.textContent = file ? file.name : '未选择文件';
    });
  }
  handleFile(fileBg, nameBg);
  handleFile(fileAvatar, nameAvatar);
  handleFile(filePhoto1, namePhoto1);
  handleFile(filePhoto2, namePhoto2);
  handleFile(filePhoto3, namePhoto3);
  handleFile(fileAlbum, nameAlbum);
  handleFile(fileMusic, nameMusic);

  function clearFileSelections() {
    fileBg.value = ''; fileAvatar.value = ''; filePhoto1.value = ''; filePhoto2.value = '';
    filePhoto3.value = ''; fileAlbum.value = ''; fileMusic.value = '';
    nameBg.textContent = '未选择文件'; nameAvatar.textContent = '未选择文件';
    namePhoto1.textContent = '未选择文件'; namePhoto2.textContent = '未选择文件';
    namePhoto3.textContent = '未选择文件'; nameAlbum.textContent = '未选择文件';
    nameMusic.textContent = '未选择文件';
  }

  if (cancelBtn) cancelBtn.addEventListener('click', clearFileSelections);
  if (closeBtn) closeBtn.addEventListener('click', clearFileSelections);

  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    function processItem(fileInput, urlInput, key, applyFn) {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        if (objectUrls[key]) URL.revokeObjectURL(objectUrls[key]);
        const newUrl = URL.createObjectURL(file);
        objectUrls[key] = newUrl;
        applyFn(newUrl);
        currentImages[key] = newUrl;
      } else {
        const url = urlInput.value.trim();
        if (url) {
          if (objectUrls[key]) { URL.revokeObjectURL(objectUrls[key]); objectUrls[key] = null; }
          applyFn(url);
          currentImages[key] = url;
        }
      }
    }

    processItem(fileBg, inputBg, 'bg', (url) => { bgDream.style.backgroundImage = `url('${url}')`; });
    processItem(fileAvatar, inputAvatar, 'avatar', (url) => { avatarImg.src = url; });
    processItem(filePhoto1, inputPhoto1, 'photo1', (url) => { photo1.src = url; });
    processItem(filePhoto2, inputPhoto2, 'photo2', (url) => { photo2.src = url; });
    processItem(filePhoto3, inputPhoto3, 'photo3', (url) => { photo3.src = url; });
    processItem(fileAlbum, inputAlbum, 'album', (url) => {
      albumCover.src = url;
      albumCover.style.display = 'block';
      albumIcon.style.display = 'none';
      currentImages.album = url;
    });

    const musicFile = fileMusic.files && fileMusic.files[0];
    if (musicFile) {
      if (objectUrls.music) URL.revokeObjectURL(objectUrls.music);
      const newUrl = URL.createObjectURL(musicFile);
      objectUrls.music = newUrl;
      currentImages.music = newUrl;
    } else {
      const url = inputMusicUrl.value.trim();
      if (url) {
        if (objectUrls.music) { URL.revokeObjectURL(objectUrls.music); objectUrls.music = null; }
        currentImages.music = url;
      }
    }

    closeModal();
    clearFileSelections();
  });

  // ==================== 音乐播放器核心 ====================
  const audio = document.getElementById('audioPlayer');
  const songTitle = document.getElementById('songTitle');
  const songArtist = document.getElementById('songArtist');
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const vinylCover = document.getElementById('vinylCover');

  let playlist = [
    { title: 'My love', artist: '颜人中', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', cover: 'https://picsum.photos/100/100?random=20', lyric: '我的爱 像风一样 来了又走' },
    { title: '夜曲', artist: '周杰伦', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', cover: 'https://picsum.photos/100/100?random=21', lyric: '一群嗜血的蚂蚁 被腐肉所吸引' },
    { title: '晴天', artist: '周杰伦', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', cover: 'https://picsum.photos/100/100?random=22', lyric: '故事的小黄花 从出生那年就飘着' },
    { title: '起风了', artist: '买辣椒也用券', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', cover: 'https://picsum.photos/100/100?random=23', lyric: '这一路上走走停停 顺着少年漂流的痕迹' }
  ];

  let currentSongIndex = 0;
  let isPlaying = false;
  let currentCustomMusicMode = false;

  function playSong(index) {
    if (currentCustomMusicMode && currentImages.music) {
      audio.src = currentImages.music;
      songTitle.textContent = '自定义音乐';
      songArtist.textContent = '来自设置面板';
      if (currentImages.album) {
        albumCover.src = currentImages.album;
        albumCover.style.display = 'block';
        albumIcon.style.display = 'none';
      } else {
        albumCover.style.display = 'none';
        albumIcon.style.display = 'block';
      }
    } else {
      if (index < 0 || index >= playlist.length) return;
      const song = playlist[index];
      audio.src = song.url;
      songTitle.textContent = song.title;
      songArtist.textContent = song.artist;
      if (currentImages.album) {
        albumCover.src = currentImages.album;
        albumCover.style.display = 'block';
        albumIcon.style.display = 'none';
      } else {
        albumCover.src = song.cover || '';
        albumCover.style.display = 'block';
        albumIcon.style.display = 'none';
      }
    }
    audio.play().then(() => {
      isPlaying = true;
      playIcon.classList.remove('fa-play');
      playIcon.classList.add('fa-pause');
      vinylCover.classList.add('spinning');
    }).catch(() => {
      isPlaying = false;
      playIcon.classList.remove('fa-pause');
      playIcon.classList.add('fa-play');
      vinylCover.classList.remove('spinning');
    });
    renderPlaylistSheet();
  }

  if (playBtn) playBtn.addEventListener('click', () => {
    if (!audio.src) { playSong(currentSongIndex); return; }
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      playIcon.classList.remove('fa-pause');
      playIcon.classList.add('fa-play');
      vinylCover.classList.remove('spinning');
    } else {
      audio.play().then(() => {
        isPlaying = true;
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
        vinylCover.classList.add('spinning');
      }).catch(() => {});
    }
  });

  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentCustomMusicMode) {
      currentCustomMusicMode = false;
      currentSongIndex = 0;
    } else {
      currentSongIndex = (currentSongIndex - 1 + playlist.length) % playlist.length;
    }
    playSong(currentSongIndex);
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentCustomMusicMode) {
      currentCustomMusicMode = false;
      currentSongIndex = 0;
    } else {
      currentSongIndex = (currentSongIndex + 1) % playlist.length;
    }
    playSong(currentSongIndex);
  });

  if (audio) audio.addEventListener('ended', () => {
    if (currentCustomMusicMode) {
      isPlaying = false;
      playIcon.classList.remove('fa-pause');
      playIcon.classList.add('fa-play');
      vinylCover.classList.remove('spinning');
    } else {
      if (nextBtn) nextBtn.click();
    }
  });

  function initPlayer() {
    if (playlist.length === 0) return;
    const song = playlist[0];
    songTitle.textContent = song.title;
    songArtist.textContent = song.artist;
    audio.src = song.url;
    albumCover.src = song.cover || '';
    albumCover.style.display = 'block';
    albumIcon.style.display = 'none';
    isPlaying = false;
    playIcon.classList.add('fa-play');
    playIcon.classList.remove('fa-pause');
    vinylCover.classList.remove('spinning');
  }
  initPlayer();

  // ==================== 歌曲列表底部弹窗 ====================
  const playlistSheet = document.getElementById('playlistSheet');
  const playlistScroll = document.getElementById('playlistScroll');
  const openManageBtn = document.getElementById('openManageBtn');
  const searchSongBtn = document.getElementById('searchSongBtn');
  const openAddBtn = document.getElementById('openAddBtn');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function renderPlaylistSheet() {
    playlistScroll.innerHTML = '';
    playlist.forEach((song, index) => {
      const row = document.createElement('div');
      row.className = 'song-row' + (index === currentSongIndex && !currentCustomMusicMode ? ' current' : '');
      row.innerHTML = `
        <div class="song-row-info">
          <div class="song-row-title">${escapeHtml(song.title)}</div>
          <div class="song-row-artist">${escapeHtml(song.lyric || song.artist)}</div>
        </div>
        <div class="song-row-radio"></div>
      `;
      row.addEventListener('click', () => {
        currentCustomMusicMode = false;
        currentSongIndex = index;
        playSong(index);
        closePlaylistSheet();
      });
      playlistScroll.appendChild(row);
    });

    if (currentImages.music) {
      const customRow = document.createElement('div');
      customRow.className = 'song-row' + (currentCustomMusicMode ? ' current' : '');
      customRow.innerHTML = `
        <div class="song-row-info">
          <div class="song-row-title">自定义音乐</div>
          <div class="song-row-artist">来自设置面板</div>
        </div>
        <div class="song-row-radio"></div>
      `;
      customRow.addEventListener('click', () => {
        currentCustomMusicMode = true;
        playSong(currentSongIndex);
        closePlaylistSheet();
      });
      playlistScroll.appendChild(customRow);
    }
  }

  function openPlaylistSheet() {
    renderPlaylistSheet();
    playlistSheet.classList.add('active');
  }
  function closePlaylistSheet() {
    playlistSheet.classList.remove('active');
  }

  if (vinylCover) vinylCover.addEventListener('click', openPlaylistSheet);
  if (playlistSheet) playlistSheet.addEventListener('click', (e) => {
    if (e.target === playlistSheet) closePlaylistSheet();
  });

  // ==================== 添加歌曲模态框 ====================
  const addModal = document.getElementById('addModal');
  const addTitle = document.getElementById('addTitle');
  const addArtist = document.getElementById('addArtist');
  const addUrl = document.getElementById('addUrl');
  const addCancel = document.getElementById('addCancel');
  const addConfirm = document.getElementById('addConfirm');

  function openAddModal() {
    addTitle.value = '';
    addArtist.value = '';
    addUrl.value = '';
    addModal.classList.add('active');
  }
  function closeAddModal() { addModal.classList.remove('active'); }

  if (openAddBtn) openAddBtn.addEventListener('click', openAddModal);
  if (addCancel) addCancel.addEventListener('click', closeAddModal);
  if (addModal) addModal.addEventListener('click', (e) => { if (e.target === addModal) closeAddModal(); });

  if (addConfirm) addConfirm.addEventListener('click', () => {
    const title = addTitle.value.trim() || '未命名歌曲';
    const artist = addArtist.value.trim() || '未知歌手';
    const url = addUrl.value.trim();
    if (!url) { alert('请填写音频链接'); return; }
    const newSong = {
      title: title,
      artist: artist,
      url: url,
      cover: 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000),
      lyric: artist
    };
    playlist.push(newSong);
    currentCustomMusicMode = false;
    currentSongIndex = playlist.length - 1;
    playSong(currentSongIndex);
    closeAddModal();
    closePlaylistSheet();
  });

  // ==================== 歌单管理模态框 ====================
  const manageModal = document.getElementById('manageModal');
  const importPlaylistBtn = document.getElementById('importPlaylistBtn');
  const exportPlaylistBtn = document.getElementById('exportPlaylistBtn');
  const importFileInput = document.getElementById('importFileInput');
  const manageCancel = document.getElementById('manageCancel');

  function openManageModal() { manageModal.classList.add('active'); }
  function closeManageModal() { manageModal.classList.remove('active'); }

  if (openManageBtn) openManageBtn.addEventListener('click', openManageModal);
  if (manageCancel) manageCancel.addEventListener('click', closeManageModal);
  if (manageModal) manageModal.addEventListener('click', (e) => { if (e.target === manageModal) closeManageModal(); });

  if (importPlaylistBtn) importPlaylistBtn.addEventListener('click', () => { importFileInput.click(); });

  if (importFileInput) importFileInput.addEventListener('change', () => {
    const file = importFileInput.files && importFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let importedSongs = [];
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) importedSongs = parsed;
          else if (parsed && Array.isArray(parsed.songs)) importedSongs = parsed.songs;
        } catch (jsonErr) {
          const lines = content.split('\n').filter(l => l.trim());
          importedSongs = lines.map(line => {
            const parts = line.split('|').map(p => p.trim());
            return {
              title: parts[0] || '未命名歌曲',
              artist: parts[1] || '未知歌手',
              url: parts[2] || '',
              cover: 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000),
              lyric: parts[1] || ''
            };
          }).filter(s => s.url);
        }
        const validSongs = importedSongs.filter(s => s && s.url).map(s => ({
          title: s.title || '未命名歌曲',
          artist: s.artist || '未知歌手',
          url: s.url,
          cover: s.cover || 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000),
          lyric: s.lyric || s.artist || ''
        }));
        if (validSongs.length === 0) { alert('未找到有效的歌曲数据'); return; }
        playlist = playlist.concat(validSongs);
        alert('成功导入 ' + validSongs.length + ' 首歌曲');
        renderPlaylistSheet();
        closeManageModal();
      } catch (err) {
        alert('导入失败：文件解析错误');
      }
      importFileInput.value = '';
    };
    reader.readAsText(file);
  });

  if (exportPlaylistBtn) exportPlaylistBtn.addEventListener('click', () => {
    const data = {
      songs: playlist.map(s => ({
        title: s.title, artist: s.artist, url: s.url, cover: s.cover || '', lyric: s.lyric || ''
      }))
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeManageModal();
  });

  if (searchSongBtn) searchSongBtn.addEventListener('click', () => {
    const keyword = prompt('搜索歌曲名称：');
    if (keyword) {
      const found = playlist.findIndex(s => s.title.includes(keyword));
      if (found >= 0) {
        currentCustomMusicMode = false;
        currentSongIndex = found;
        playSong(found);
        closePlaylistSheet();
      } else {
        alert('未找到匹配的歌曲');
      }
    }
  });

  // ==================== 底部 Tab 选中状态 ====================
  const tabButtons = document.querySelectorAll('#bottomTabBar .tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ==================== 初始化传讯功能 ====================
  // 调用 message.js 导出的初始化函数
  if (typeof initMessageApp === 'function') {
    initMessageApp();
  }

})();
