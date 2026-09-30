/**
 * 传讯页面扩展功能（独立模块）
 * 1. 连发模式：暂存多条消息，一次性发送
 * 2. 图片发送：上传本地文件或粘贴 URL
 * 3. 表情包联动：从 cardDatabase.sticker 抽取
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

    // 添加头像（与 chat-avatars.js 一致）
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

  // ==================== 触发自动回复 ====================
  function triggerAutoReply() {
    // 复用 chat.js 的自动回复逻辑：通过模拟输入框发送
    // 由于 chat.js 的 sendMessage 是内部函数，我们无法直接调用
    // 但可以派发一个自定义事件，或直接复用其公开 API
    if (typeof window.triggerChatAutoReply === 'function') {
      window.triggerChatAutoReply();
    } else {
      // 兜底：直接调用 chat.js 中暴露的接口（若存在）
      // 若无，则不做任何事（不会报错）
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

    // 左侧按钮组（√ 和 X）
    var actionGroup = document.createElement('div');
    actionGroup.className = 'burst-action-group';
    actionGroup.id = 'burstActionGroup';
    actionGroup.style.display = 'none';
    actionGroup.innerHTML =
      '<button class="burst-btn burst-confirm" id="burstConfirm" title="发送全部">' +
      '  <i class="fa-solid fa-check"></i>' +
      '</button>' +
      '<button class="burst-btn burst-cancel" id="burstCancel" title="清空暂存">' +
      '  <i class="fa-solid fa-xmark"></i>' +
      '</button>';
    chatInputBar.insertBefore(actionGroup, chatInputBar.firstChild);

    // 绑定
    document.getElementById('burstConfirm').addEventListener('click', function () {
      if (burstQueue.length === 0) {
        alert('暂存列表为空');
        return;
      }
      // 一次性发送所有暂存
      burstQueue.forEach(function (item) {
        sendOneMessage(item);
      });
      burstQueue = [];
      renderBurstQueue();
      // 触发一次自动回复
      triggerAutoReply();
    });

    document.getElementById('burstCancel').addEventListener('click', function () {
      burstQueue = [];
      renderBurstQueue();
    });
  }

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
      if (typeof item === 'string') {
        chip.innerHTML = '<span class="burst-chip-num">' + (index + 1) + '</span>' +
          '<span class="burst-chip-text">' + escapeHtml(item) + '</span>' +
          '<span class="burst-chip-del" data-idx="' + index + '"><i class="fa-solid fa-xmark"></i></span>';
      } else if (item && item.type === 'image') {
        chip.innerHTML = '<span class="burst-chip-num">' + (index + 1) + '</span>' +
          '<img src="' + item.url + '" class="burst-chip-img">' +
          '<span class="burst-chip-del" data-idx="' + index + '"><i class="fa-solid fa-xmark"></i></span>';
      }
      queueBox.appendChild(chip);
    });

    // 绑定删除
    queueBox.querySelectorAll('.burst-chip-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        burstQueue.splice(idx, 1);
        renderBurstQueue();
      });
    });
  }

  function enterBurstMode() {
    burstMode = true;
    createBurstUI();
    var hint = document.getElementById('burstHint');
    if (hint) hint.style.display = 'flex';
    var group = document.getElementById('burstActionGroup');
    if (group) group.style.display = 'flex';
    // 修改输入框 placeholder
    chatInput.placeholder = '连发模式：输入后按回车暂存...';
    // 修改连发按钮图标状态
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
  // 使用捕获阶段，优先于原有逻辑
  sendBtn.addEventListener('click', function (e) {
    if (!burstMode) return; // 非连发模式，交给原有逻辑
    e.stopImmediatePropagation();
    e.preventDefault();
    var text = chatInput.value.trim();
    if (!text) return;
    burstQueue.push(text);
    chatInput.value = '';
    // 更新发送按钮状态
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
      burstQueue.push(text);
      chatInput.value = '';
      sendBtn.disabled = true;
      renderBurstQueue();
    }
  }, true);

  // ==================== 连发按钮 ====================
  function createBurstButton() {
    if (document.getElementById('burstModeBtn')) return;
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

    // 插入到输入框左侧图标栏第一个位置
    var leftIcons = chatInputBar.querySelector('.input-left-icons');
    if (leftIcons) {
      leftIcons.insertBefore(btn, leftIcons.firstChild);
    }
  }

  // ==================== 图片发送 ====================
  function openImageOptions() {
    // 弹出选项面板
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

      // 上传本地文件
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

      // 粘贴 URL
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
      // 连发模式：暂存图片
      burstQueue.push({ type: 'image', url: url });
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

    // 渲染表情包
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

  // ==================== 替换左侧图标的事件 ====================
  function rebindLeftIcons() {
    var leftIcons = chatInputBar.querySelector('.input-left-icons');
    if (!leftIcons) return;
    var icons = leftIcons.querySelectorAll('i');
    // 原有 3 个图标：相册、图片、表情
    icons.forEach(function (icon) {
      var title = icon.getAttribute('title') || '';
      if (title === '图片') {
        // 替换点击事件（用捕获阶段优先）
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
      // "相册" 保持原有行为（只打印日志）
    });
  }

  // ==================== 初始化 ====================
  function init() {
    createBurstButton();
    rebindLeftIcons();
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
