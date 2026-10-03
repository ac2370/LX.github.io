/**
 * 传讯页面扩展功能（独立模块）
 * 1. 连发模式：替换输入栏最左侧的现有图标，暂存消息一次性发送
 * 2. 图片发送：上传本地文件或粘贴 URL
 * 3. 表情包联动：从 cardDatabase.sticker 抽取
 * 4. 拍一拍：双击头像 → 从字卡库"拍一拍"分类选一条发送
 *
 * 完全独立，不修改任何现有逻辑
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var sendBtn = document.getElementById('sendBtn');
  var chatInputBar = document.querySelector('#pageChat .chat-input-bar');

  if (!chatMessages || !chatInput || !sendBtn || !chatInputBar) return;

  // ==================== 状态 ====================
  var burstMode = false;
  var burstQueue = [];

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getTimeStr() {
    var d = new Date();
    var h = d.getHours().toString().padStart(2, '0');
    var m = d.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
  }

  // ==================== 获取我的头像 ====================
  function getMyAvatar() {
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
    if (window.homeSettings && window.homeSettings.current && window.homeSettings.current.avatar) {
      return window.homeSettings.current.avatar;
    }
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.avatar) return data.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/100/100?random=1';
  }

  // ==================== 获取对方头像 ====================
  function getContactAvatar() {
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar && chatAvatar.src) return chatAvatar.src;
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var currentId = localStorage.getItem('my_current_contact');
      if (Array.isArray(contacts)) {
        var cur = contacts.find(function (c) { return c.id === currentId; }) || contacts[0];
        if (cur && cur.avatar) return cur.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/200/200?random=99';
  }

  // ==================== 获取对方昵称 ====================
  function getContactName() {
    var nameEl = document.getElementById('chatName');
    if (nameEl && nameEl.textContent.trim()) return nameEl.textContent.trim();
    return 'Ta';
  }

  // ==================== 创建消息行（带头像） ====================
  function createMessageRow(type, content) {
    var row = document.createElement('div');
    row.className = 'message-row ' + type;

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (typeof content === 'string') {
      bubble.textContent = content;
    } else if (content && content.type === 'image') {
      var img = document.createElement('img');
      img.src = content.url;
      img.alt = '图片';
      img.style.maxWidth = '180px';
      img.style.maxHeight = '180px';
      img.style.borderRadius = '12px';
      img.style.display = 'block';
      img.style.cursor = 'pointer';
      img.onclick = function () { window.open(content.url, '_blank'); };
      bubble.appendChild(img);
    } else if (content && content.quote) {
      var quoteEl = document.createElement('span');
      quoteEl.className = 'quote-block';
      quoteEl.textContent = '> ' + content.quote;
      bubble.appendChild(quoteEl);
      bubble.appendChild(document.createTextNode(content.text));
    }

    row.appendChild(bubble);

    // 添加头像
    var avatar = document.createElement('img');
    avatar.className = 'chat-msg-avatar';
    avatar.src = type === 'self' ? getMyAvatar() : getContactAvatar();
    avatar.alt = type === 'self' ? '我' : '对方';
    avatar.onerror = function () {
      avatar.src = type === 'self'
        ? 'https://picsum.photos/100/100?random=1'
        : 'https://picsum.photos/200/200?random=99';
    };
    if (type === 'self') {
      row.appendChild(avatar);
    } else {
      row.insertBefore(avatar, row.firstChild);
    }

    return row;
  }

  // ==================== 滚动到底部 ====================
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 发送一条消息 ====================
  function sendOneMessage(content) {
    chatMessages.appendChild(createMessageRow('self', content));
    scrollToBottom();
  }

  // ==================== 触发自动回复（复用 chat.js） ====================
  function triggerAutoReply() {
    if (typeof window.triggerChatAutoReply === 'function') {
      window.triggerChatAutoReply();
    } else {
      // chat.js 暴露的自动回复函数（通过自定义事件触发）
      var event = new CustomEvent('chatAutoReply');
      window.dispatchEvent(event);
    }
  }

  // ==================== 连发模式 UI ====================
  function createBurstUI() {
    if (document.getElementById('burstHint')) return;

    // 提示框（输入框上方）
    var hint = document.createElement('div');
    hint.className = 'burst-hint';
    hint.id = 'burstHint';
    hint.innerHTML = '<i class="fa-solid fa-bolt"></i> [连发模式] 虚线暂存，发完点左侧 ☑ 发送';
    chatInputBar.parentNode.insertBefore(hint, chatInputBar);

    // 暂存列表（在提示框和输入栏之间）
    var queueBox = document.createElement('div');
    queueBox.className = 'burst-queue';
    queueBox.id = 'burstQueue';
    chatInputBar.parentNode.insertBefore(queueBox, chatInputBar);

    // 左侧按钮组（√ 和 X）—— 插到 input-left-icons 之前
    var actionGroup = document.createElement('div');
    actionGroup.className = 'burst-action-group';
    actionGroup.id = 'burstActionGroup';
    actionGroup.style.display = 'none';
    actionGroup.innerHTML =
      '<button class="burst-btn burst-confirm" id="burstConfirm" title="发送全部">' +
      '  <i class="fa-solid fa-check"></i>' +
      '</button>' +
      '<button class="burst-btn burst-cancel" id="burstCancel" title="清空并退出">' +
      '  <i class="fa-solid fa-xmark"></i>' +
      '</button>';
    chatInputBar.insertBefore(actionGroup, chatInputBar.firstChild);

    // 绑定 √ 发送
    document.getElementById('burstConfirm').addEventListener('click', function () {
      if (burstQueue.length === 0) {
        alert('暂存列表为空');
        return;
      }
      burstQueue.forEach(function (item) {
        sendOneMessage(item);
      });
      burstQueue = [];
      renderBurstQueue();
      exitBurstMode();
      triggerAutoReply();
    });

    // 绑定 X 取消（清空并退出）
    document.getElementById('burstCancel').addEventListener('click', function () {
      burstQueue = [];
      renderBurstQueue();
      exitBurstMode();
    });
  }

  // ==================== 渲染暂存列表 ====================
  function renderBurstQueue() {
    var queueBox = document.getElementById('burstQueue');
    if (!queueBox) return;
    if (burstQueue.length === 0) {
      queueBox.innerHTML = '';
      queueBox.style.display = 'none';
      return;
    }
    queueBox.style.display = 'flex';
    queueBox.innerHTML = '';
    burstQueue.forEach(function (item, index) {
      var chip = document.createElement('div');
      chip.className = 'burst-chip';

      var timeStr = item._time || getTimeStr();
      var numHtml = '<span class="burst-chip-num">' + (index + 1) + '</span>';
      var timeHtml = '<span class="burst-chip-time">' + timeStr + '</span>';
      var tagHtml = '<span class="burst-chip-tag">[未发送]</span>';

      if (typeof item === 'string' || (item && item.type === 'text')) {
        var text = typeof item === 'string' ? item : item.text;
        chip.innerHTML = numHtml +
          '<span class="burst-chip-text">' + escapeHtml(text) + '</span>' +
          timeHtml + tagHtml +
          '<span class="burst-chip-del" data-idx="' + index + '"><i class="fa-solid fa-xmark"></i></span>';
      } else if (item && item.type === 'image') {
        chip.innerHTML = numHtml +
          '<img src="' + item.url + '" class="burst-chip-img">' +
          timeHtml + tagHtml +
          '<span class="burst-chip-del" data-idx="' + index + '"><i class="fa-solid fa-xmark"></i></span>';
      }
      queueBox.appendChild(chip);
    });

    // 绑定单条删除
    queueBox.querySelectorAll('.burst-chip-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        burstQueue.splice(idx, 1);
        renderBurstQueue();
      });
    });
  }

  // ==================== 进入/退出连发模式 ====================
  function enterBurstMode() {
    burstMode = true;
    createBurstUI();
    var hint = document.getElementById('burstHint');
    if (hint) hint.style.display = 'flex';
    var group = document.getElementById('burstActionGroup');
    if (group) group.style.display = 'flex';
    chatInput.placeholder = '连发模式：输入后按回车暂存...';
    var burstBtn = document.getElementById('burstModeBtn');
    if (burstBtn) burstBtn.classList.add('active');
  }

  function exitBurstMode() {
    burstMode = false;
    burstQueue = [];
    renderBurstQueue();
    var hint = document.getElementById('burstHint');
    if (hint) hint.style.display = 'none';
    var group = document.getElementById('burstActionGroup');
    if (group) group.style.display = 'none';
    chatInput.placeholder = '输入消息...';
    var burstBtn = document.getElementById('burstModeBtn');
    if (burstBtn) burstBtn.classList.remove('active');
  }

  // ==================== 拦截发送按钮 ====================
  sendBtn.addEventListener('click', function (e) {
    if (!burstMode) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    var text = chatInput.value.trim();
    if (!text) return;
    burstQueue.push({ type: 'text', text: text, _time: getTimeStr() });
    chatInput.value = '';
    sendBtn.disabled = true;
    renderBurstQueue();
  }, true);

  // 拦截回车
  chatInput.addEventListener('keydown', function (e) {
    if (!burstMode) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.stopImmediatePropagation();
      e.preventDefault();
      var text = chatInput.value.trim();
      if (!text) return;
      burstQueue.push({ type: 'text', text: text, _time: getTimeStr() });
      chatInput.value = '';
      sendBtn.disabled = true;
      renderBurstQueue();
    }
  }, true);

  // ==================== 替换输入栏最左侧现有图标 ====================
  function replaceLeftmostIcon() {
    var leftIcons = chatInputBar.querySelector('.input-left-icons');
    if (!leftIcons) return;

    // 找到第一个图标（原来可能是"相册"）
    var firstIcon = leftIcons.querySelector('i');
    if (!firstIcon) return;

    // 如果已经替换过，跳过
    if (firstIcon.id === 'burstModeBtn') return;

    // 保留原 DOM（不删除），改为隐藏
    firstIcon.style.display = 'none';

    // 新建连发按钮（插到原图标前面）
    var btn = document.createElement('i');
    btn.id = 'burstModeBtn';
    btn.className = 'fa-solid fa-bolt';
    btn.title = '连发模式';
    btn.style.cssText = 'color:#8fa8bd;font-size:18px;cursor:pointer;transition:color 0.15s ease,transform 0.15s ease;flex-shrink:0;';
    btn.addEventListener('click', function () {
      if (burstMode) {
        exitBurstMode();
      } else {
        enterBurstMode();
      }
    });
    leftIcons.insertBefore(btn, firstIcon);
  }

  // ==================== 图片发送 ====================
  function openImageOptions() {
    var panel = document.getElementById('imageOptionPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'imageOptionPanel';
      panel.className = 'chat-option-panel';
      panel.innerHTML =
        '<div class="chat-option-inner">' +
        '  <div class="chat-option-title">发送图片</div>' +
        '  <button class="chat-option-btn" id="optUploadImage">' +
        '    <i class="fa-solid fa-upload"></i> 上传本地文件' +
        '  </button>' +
        '  <button class="chat-option-btn" id="optPasteImageUrl">' +
        '    <i class="fa-solid fa-link"></i> 粘贴图片 URL' +
        '  </button>' +
        '  <button class="chat-option-cancel" id="optCancelImage">取消</button>' +
        '</div>';
      document.body.appendChild(panel);

      document.getElementById('optCancelImage').addEventListener('click', function () {
        panel.classList.remove('active');
      });
      panel.addEventListener('click', function (e) {
        if (e.target === panel) panel.classList.remove('active');
      });

      document.getElementById('optUploadImage').addEventListener('click', function () {
        panel.classList.remove('active');
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          if (!file) { document.body.removeChild(input); return; }
          var reader = new FileReader();
          reader.onload = function (ev) {
            sendImage(ev.target.result);
            document.body.removeChild(input);
          };
          reader.readAsDataURL(file);
        });
        input.click();
      });

      document.getElementById('optPasteImageUrl').addEventListener('click', function () {
        panel.classList.remove('active');
        var url = prompt('请输入图片 URL：');
        if (url && url.trim()) {
          sendImage(url.trim());
        }
      });
    }
    panel.classList.add('active');
  }

  function sendImage(url) {
    if (burstMode) {
      burstQueue.push({ type: 'image', url: url, _time: getTimeStr() });
      renderBurstQueue();
      return;
    }
    sendOneMessage({ type: 'image', url: url });
    triggerAutoReply();
  }

  // ==================== 表情包面板 ====================
  function openStickerPanel() {
    var panel = document.getElementById('stickerPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'stickerPanel';
      panel.className = 'chat-option-panel';
      panel.innerHTML =
        '<div class="chat-option-inner chat-sticker-inner">' +
        '  <div class="chat-option-title">表情包</div>' +
        '  <div class="sticker-grid" id="stickerGrid"></div>' +
        '  <button class="chat-option-cancel" id="optCancelSticker">关闭</button>' +
        '</div>';
      document.body.appendChild(panel);

      document.getElementById('optCancelSticker').addEventListener('click', function () {
        panel.classList.remove('active');
      });
      panel.addEventListener('click', function (e) {
        if (e.target === panel) panel.classList.remove('active');
      });
    }

    var grid = document.getElementById('stickerGrid');
    var stickers = (window.cardDatabase && window.cardDatabase.sticker) || [];
    if (stickers.length === 0) {
      grid.innerHTML = '<div class="sticker-empty">还没有表情包，去字卡库的「表情包」分类添加吧~</div>';
    } else {
      grid.innerHTML = '';
      stickers.forEach(function (url) {
        var item = document.createElement('div');
        item.className = 'sticker-item';
        var img = document.createElement('img');
        img.src = url;
        img.alt = '表情包';
        img.onerror = function () { img.src = 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000); };
        item.appendChild(img);
        item.addEventListener('click', function () {
          panel.classList.remove('active');
          sendImage(url);
        });
        grid.appendChild(item);
      });
    }
    panel.classList.add('active');
  }

  // ==================== 绑定"图片"和"表情"图标 ====================
  function rebindLeftIcons() {
    var leftIcons = chatInputBar.querySelector('.input-left-icons');
    if (!leftIcons) return;
    var icons = leftIcons.querySelectorAll('i');
    icons.forEach(function (icon) {
      var title = icon.getAttribute('title') || '';
      // 已经隐藏的原"相册"图标不处理
      if (icon.id === 'burstModeBtn') return;

      if (title === '图片') {
        icon.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          openImageOptions();
        }, true);
      } else if (title === '表情') {
        icon.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          openStickerPanel();
        }, true);
      }
    });
  }

  /* ============================================================
     4. 拍一拍（双击头像 → 从字卡库"拍一拍"分类选一条发送）
     ============================================================ */
  function initPatFeature() {
    var chatAvatar = document.getElementById('chatAvatar');
    if (!chatAvatar) return;

       // ---------- 单击头像 → 拍一拍 ----------
    // （单击昵称由 role-panel.js 处理，弹出角色面板）
    chatAvatar.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openPatModal();
    }, true /* 捕获阶段，先于其它监听 */);

    // ---------- 弹窗 DOM ----------
    var modal = document.createElement('div');
    modal.className = 'pat-modal';
    modal.id = 'patModal';
    modal.innerHTML =
      '<div class="pat-panel">' +
        '<div class="pat-header">' +
          '<span class="pat-title" id="patTitle">拍一拍 Ta</span>' +
          '<button class="pat-close" id="patClose" type="button"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="pat-body" id="patBody"></div>' +
        '<div class="pat-footer">' +
          '<button class="pat-btn pat-cancel" id="patCancel" type="button">取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var patTitle  = modal.querySelector('#patTitle');
    var patBody   = modal.querySelector('#patBody');
    var patClose  = modal.querySelector('#patClose');
    var patCancel = modal.querySelector('#patCancel');

    // ---------- 打开 ----------
    function openPatModal() {
      var cards = (typeof window.getPatCards === 'function') ? window.getPatCards() : [];
      if (!Array.isArray(cards)) cards = [];

      patTitle.textContent = '拍一拍 ' + getContactName();

      if (cards.length === 0) {
        patBody.innerHTML =
          '<div class="pat-empty">' +
            '<i class="fa-solid fa-hand"></i>' +
            '<div>还没有拍一拍字卡</div>' +
            '<div class="pat-empty-hint">去字卡库 → 拍一拍 添加几句吧</div>' +
          '</div>';
      } else {
        var html = '';
        cards.forEach(function (text, idx) {
          html += '<div class="pat-item" data-idx="' + idx + '">' +
            '<i class="fa-solid fa-hand-point-right pat-item-icon"></i>' +
            '<span class="pat-item-text">' + escapeHtml(text) + '</span>' +
            '</div>';
        });
        patBody.innerHTML = html;

        patBody.querySelectorAll('.pat-item').forEach(function (el) {
          el.addEventListener('click', function () {
            var i = parseInt(el.getAttribute('data-idx'), 10);
            var picked = cards[i];
            if (picked) sendPat(picked);
            closePatModal();
          });
        });
      }

      modal.classList.add('active');
    }

    // ---------- 关闭 ----------
    function closePatModal() {
      modal.classList.remove('active');
    }

    patClose.addEventListener('click', closePatModal);
    patCancel.addEventListener('click', closePatModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closePatModal();
    });

    // ---------- 发送 ----------
    function sendPat(text) {
      var contactName = getContactName();

      // 1) 居中系统提示气泡（复用 .system-call-event + .call-record-bubble）
      var sysRow = document.createElement('div');
      sysRow.className = 'message-row system-call-event';
      var sysBubble = document.createElement('div');
      sysBubble.className = 'call-record-bubble';
      sysBubble.innerHTML =
        '<i class="fa-solid fa-hand"></i>' +
        '<span>你拍了拍 ' + escapeHtml(contactName) + '：' + escapeHtml(text) + '</span>';
      sysRow.appendChild(sysBubble);
      chatMessages.appendChild(sysRow);
      scrollToBottom();

      // 2) 延迟 2~5 秒，从"回复"分类抽 1 条，以对方气泡发送
      var delay = 2000 + Math.floor(Math.random() * 3000);
      setTimeout(function () {
        var replies = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
        if (!Array.isArray(replies) || replies.length === 0) return;

        var replyText = randomPick(replies);
        if (!replyText) return;

        var row = document.createElement('div');
        row.className = 'message-row other';
        var bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = replyText;
        row.appendChild(bubble);
        chatMessages.appendChild(row);
        scrollToBottom();

        // 通知模块联动
        if (window.chatNotify && typeof window.chatNotify.show === 'function') {
          try { window.chatNotify.show(contactName, replyText); } catch (e) {}
        }
      }, delay);
    }

    // 暴露给外部（可选）
    window.openPatModal = openPatModal;
    window.closePatModal = closePatModal;
  }

  // ==================== 初始化 ====================
  function init() {
    replaceLeftmostIcon();
    rebindLeftIcons();
    initPatFeature();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 稍后再执行一次，确保 chat.js 和 chat-avatars.js 已加载
  setTimeout(init, 200);
  setTimeout(init, 800);

  // 暴露给外部
  window.chatExtras = {
    enterBurstMode: enterBurstMode,
    exitBurstMode: exitBurstMode,
    sendImage: sendImage,
    openStickerPanel: openStickerPanel
  };

})();
