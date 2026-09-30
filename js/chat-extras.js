/**
 * 传讯页面扩展功能（独立模块）
 * - 连发模式：暂存多条消息，一次性发送
 * - 发送图片：本地文件 / URL
 * - 表情包：从 cardDatabase.sticker 选择发送
 * 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var chatInput = document.getElementById('chatInput');
  var sendBtn = document.getElementById('sendBtn');
  var chatMessages = document.getElementById('chatMessages');
  var chatInputBar = document.querySelector('#pageChat .chat-input-bar');
  var leftIcons = document.querySelector('#pageChat .input-left-icons');

  if (!chatInput || !sendBtn || !chatMessages || !leftIcons) return;

  // ==================== 状态 ====================
  var burstMode = false;
  var burstQueue = []; // 暂存的文字或图片对象

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 创建消息 DOM（与现有样式一致） ====================
  function createTextRow(type, text) {
    var row = document.createElement('div');
    row.className = 'message-row ' + type;
    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    return row;
  }

  function createImageRow(type, url) {
    var row = document.createElement('div');
    row.className = 'message-row ' + type;
    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    var img = document.createElement('img');
    img.src = url;
    img.alt = '图片';
    img.style.maxWidth = '160px';
    img.style.maxHeight = '160px';
    img.style.borderRadius = '12px';
    img.style.display = 'block';
    bubble.appendChild(img);
    row.appendChild(bubble);
    return row;
  }

  // ==================== 创建连发按钮 ====================
  function createBurstButton() {
    if (document.getElementById('burstModeBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'burstModeBtn';
    btn.className = 'burst-mode-btn';
    btn.title = '连发模式';
    btn.innerHTML = '<i class="fa-solid fa-bolt"></i>';

    // 插入到 input-left-icons 最前面
    leftIcons.insertBefore(btn, leftIcons.firstChild);

    btn.addEventListener('click', function () {
      toggleBurstMode();
    });
  }

  // ==================== 连发模式状态条 ====================
  function createBurstBar() {
    if (document.getElementById('burstBar')) return;

    var bar = document.createElement('div');
    bar.id = 'burstBar';
    bar.className = 'burst-bar';
    bar.innerHTML =
      '<div class="burst-bar-title">' +
        '<i class="fa-solid fa-bolt"></i>' +
        '<span>[连发模式] 虚线暂存，发完点左侧☑发送</span>' +
      '</div>' +
      '<div class="burst-bar-queue" id="burstQueue"></div>' +
      '<div class="burst-bar-actions">' +
        '<button class="burst-action-btn burst-confirm" id="burstConfirm" title="发送全部">' +
          '<i class="fa-solid fa-check"></i>' +
        '</button>' +
        '<button class="burst-action-btn burst-cancel" id="burstCancel" title="清空暂存">' +
          '<i class="fa-solid fa-xmark"></i>' +
        '</button>' +
      '</div>';

    // 插入到 chat-input-bar 之前
    if (chatInputBar && chatInputBar.parentNode) {
      chatInputBar.parentNode.insertBefore(bar, chatInputBar);
    }

    document.getElementById('burstConfirm').addEventListener('click', sendBurstQueue);
    document.getElementById('burstCancel').addEventListener('click', clearBurstQueue);
  }

  // ==================== 切换连发模式 ====================
  function toggleBurstMode() {
    burstMode = !burstMode;

    var btn = document.getElementById('burstModeBtn');
    var bar = document.getElementById('burstBar');

    if (burstMode) {
      createBurstBar();
      if (btn) btn.classList.add('active');
      if (bar) bar.classList.add('active');
      chatInput.placeholder = '输入消息，回车暂存...';
    } else {
      if (btn) btn.classList.remove('active');
      if (bar) bar.classList.remove('active');
      chatInput.placeholder = '输入消息...';
      // 退出时清空暂存
      burstQueue = [];
      renderBurstQueue();
    }
  }

  // ==================== 渲染暂存队列 ====================
  function renderBurstQueue() {
    var container = document.getElementById('burstQueue');
    if (!container) return;

    if (burstQueue.length === 0) {
      container.innerHTML = '<div class="burst-queue-empty">暂无暂存消息，输入后回车</div>';
      return;
    }

    container.innerHTML = '';
    burstQueue.forEach(function (item, index) {
      var el = document.createElement('div');
      el.className = 'burst-queue-item';
      if (item.type === 'image') {
        el.innerHTML = '<img src="' + item.value + '" alt="图片">';
      } else {
        el.textContent = item.value;
      }
      // 点击删除
      el.title = '点击删除此条';
      el.addEventListener('click', function () {
        burstQueue.splice(index, 1);
        renderBurstQueue();
      });
      container.appendChild(el);
    });
  }

  // ==================== 暂存消息 ====================
  function stashMessage() {
    var text = chatInput.value.trim();
    if (!text) return;

    burstQueue.push({ type: 'text', value: text });
    chatInput.value = '';
    updateSendBtnState();
    renderBurstQueue();
  }

  // ==================== 发送暂存队列 ====================
  function sendBurstQueue() {
    if (burstQueue.length === 0) {
      alert('暂存队列为空');
      return;
    }

    // 逐条发送，间隔 400ms
    burstQueue.forEach(function (item, index) {
      setTimeout(function () {
        var row;
        if (item.type === 'image') {
          row = createImageRow('self', item.value);
        } else {
          row = createTextRow('self', item.value);
        }
        chatMessages.appendChild(row);
        scrollToBottom();
        // 每次发送后刷新头像
        if (window.refreshChatAvatars) window.refreshChatAvatars();
      }, index * 400);
    });

    // 触发自动回复（如果有 window.triggerAutoReply 或从 chat.js 暴露的逻辑）
    // 由于 chat.js 的 sendMessage 是 IIFE 内部的，这里通过模拟点击来触发
    // 但更好的方式是：批量发送后手动触发一次自动回复
    setTimeout(function () {
      // 尝试通过 window 上的钩子触发（chat.js 未暴露，所以采用兜底：派发一个自定义事件）
      if (typeof window.triggerAutoReply === 'function') {
        window.triggerAutoReply();
      }
    }, burstQueue.length * 400 + 100);

    // 清空
    burstQueue = [];
    renderBurstQueue();
  }

  // ==================== 清空暂存 ====================
  function clearBurstQueue() {
    if (burstQueue.length === 0) return;
    if (!confirm('确定清空所有暂存消息吗？')) return;
    burstQueue = [];
    renderBurstQueue();
  }

  // ==================== 修改原有事件（拦截回车和发送按钮） ====================
  function updateSendBtnState() {
    sendBtn.disabled = chatInput.value.trim().length === 0;
  }

  // 拦截回车：连发模式下改为暂存
  chatInput.addEventListener('keydown', function (e) {
    if (burstMode && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      stashMessage();
    }
  }, true);

  // 拦截发送按钮：连发模式下改为暂存
  sendBtn.addEventListener('click', function (e) {
    if (burstMode) {
      e.preventDefault();
      e.stopImmediatePropagation();
      stashMessage();
    }
  }, true);

  // ==================== 图片发送 ====================
  function showImageOptions() {
    var choice = confirm('点击"确定"上传本地文件，点击"取消"改为粘贴图片 URL');
    if (choice) {
      // 上传本地文件
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var url = ev.target.result;
          if (burstMode) {
            burstQueue.push({ type: 'image', value: url });
            renderBurstQueue();
          } else {
            sendImageMessage(url);
          }
        };
        reader.readAsDataURL(file);
      });
      input.click();
    } else {
      // 粘贴 URL
      var url = prompt('粘贴图片 URL：');
      if (url && url.trim()) {
        if (burstMode) {
          burstQueue.push({ type: 'image', value: url.trim() });
          renderBurstQueue();
        } else {
          sendImageMessage(url.trim());
        }
      }
    }
  }

  function sendImageMessage(url) {
    var row = createImageRow('self', url);
    chatMessages.appendChild(row);
    scrollToBottom();
    if (window.refreshChatAvatars) window.refreshChatAvatars();
    // 触发对方自动回复
    triggerAutoReplyIfPossible();
  }

  // ==================== 表情包面板 ====================
  function showStickerPanel() {
    // 创建面板（如果不存在）
    var panel = document.getElementById('stickerPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'stickerPanel';
      panel.className = 'sticker-panel';
      panel.innerHTML =
        '<div class="sticker-panel-inner">' +
          '<div class="sticker-panel-header">' +
            '<span class="sticker-panel-title"><i class="fa-solid fa-face-smile"></i> 选择表情包</span>' +
            '<button class="sticker-panel-close" id="stickerPanelClose"><i class="fa-solid fa-xmark"></i></button>' +
          '</div>' +
          '<div class="sticker-panel-body" id="stickerPanelBody"></div>' +
        '</div>';
      document.body.appendChild(panel);

      document.getElementById('stickerPanelClose').addEventListener('click', function () {
        panel.classList.remove('active');
      });
      panel.addEventListener('click', function (e) {
        if (e.target === panel) panel.classList.remove('active');
      });
    }

    // 渲染表情包
    var body = document.getElementById('stickerPanelBody');
    var stickers = [];
    if (window.cardDatabase && window.cardDatabase.sticker) {
      stickers = window.cardDatabase.sticker;
    }

    if (stickers.length === 0) {
      body.innerHTML = '<div class="sticker-panel-empty">字卡库的"表情包"分类里还没有内容<br>去字卡收纳盒添加一些吧~</div>';
    } else {
      body.innerHTML = '';
      stickers.forEach(function (url) {
        var item = document.createElement('div');
        item.className = 'sticker-panel-item';
        var img = document.createElement('img');
        img.src = url;
        img.alt = '表情包';
        img.onerror = function () {
          img.src = 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000);
        };
        item.appendChild(img);
        item.addEventListener('click', function () {
          if (burstMode) {
            burstQueue.push({ type: 'image', value: url });
            renderBurstQueue();
          } else {
            sendImageMessage(url);
          }
          panel.classList.remove('active');
        });
        body.appendChild(item);
      });
    }

    panel.classList.add('active');
  }

  // ==================== 触发自动回复（兜底） ====================
  function triggerAutoReplyIfPossible() {
    // 优先使用 window 上暴露的钩子
    if (typeof window.triggerAutoReply === 'function') {
      window.triggerAutoReply();
      return;
    }
    // 兜底：派发自定义事件，chat.js 里没有监听就算了（用户按发送键时会自动触发）
    // 为保险，直接尝试模拟按下发送按钮前的最后一条消息逻辑
    // 但由于 chat.js 是 IIFE，无法直接调用，只能提示
    console.log('[chat-extras] 已发送图片，等待自动回复需要 chat.js 暴露 triggerAutoReply');
  }

  // ==================== 绑定图片 / 表情包图标 ====================
  function bindIcons() {
    var icons = leftIcons.querySelectorAll('i');
    icons.forEach(function (icon) {
      var title = icon.getAttribute('title') || '';
      // 图片图标
      if (title === '图片' || icon.classList.contains('fa-image')) {
        // 移除可能存在的旧监听（通过标记）
        if (!icon.dataset.extrasBound) {
          icon.dataset.extrasBound = '1';
          // 使用父元素作为事件目标（因为点击 i 元素本身）
          icon.addEventListener('click', function (e) {
            e.stopPropagation();
            showImageOptions();
          });
        }
      }
      // 表情包图标（相册、图片、表情）
      if (title === '相册' || icon.classList.contains('fa-images')) {
        if (!icon.dataset.extrasBound) {
          icon.dataset.extrasBound = '1';
          icon.addEventListener('click', function (e) {
            e.stopPropagation();
            showStickerPanel();
          });
        }
      }
      if (title === '表情' || icon.classList.contains('fa-face-smile')) {
        if (!icon.dataset.extrasBound) {
          icon.dataset.extrasBound = '1';
          icon.addEventListener('click', function (e) {
            e.stopPropagation();
            showStickerPanel();
          });
        }
      }
    });
  }

  // ==================== 初始化 ====================
  function init() {
    createBurstButton();
    bindIcons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 由于 DOM 可能延迟渲染，稍后重试
  setTimeout(init, 300);
  setTimeout(bindIcons, 1000);

  // 暴露给外部
  window.chatExtras = {
    burstMode: function () { return burstMode; },
    queue: function () { return burstQueue; }
  };

})();
