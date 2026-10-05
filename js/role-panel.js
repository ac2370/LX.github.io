/* ============================================================
   role-panel.js —— 角色面板（多角色管理）· 新版
   功能：
     - 会话选择页右上角「＋」→ 打开角色面板（聊天页点昵称不再打开）
     - 面板结构（自上而下）：
         · 「我的角色」编辑区（常驻）：我自己的头像、昵称、保存我的资料
         · 「当前角色」编辑区（常驻）：改昵称、上传头像、粘贴 URL
         · 「所有角色」列表：点击切换、删除
         · 「+ 添加好友」按钮（虚线）→ 展开新建角色区
         · 「关闭」按钮（满宽）
     - 数据存 localStorage：
         · my_contacts        [{id, name, avatar}]
         · my_current_contact 当前 id
         · my_profile         {name, avatar}（「我的」头像昵称，聊天页全局跟随）
     - 切换角色后广播事件，让 chat-avatars / mood 等刷新
   依赖：
     - HTML 中的 #rolePanelModal / #roleListContainer 等节点
     - （可选）window.refreshChatAvatars / window.refreshMoodPage
   ============================================================ */
(function () {
  'use strict';

  // ==================== 常量 ====================
  var LS_CONTACTS_KEY = 'my_contacts';
  var LS_CURRENT_KEY  = 'my_current_contact';
  var MY_PROFILE_KEY  = 'my_profile';
  var DEFAULT_CONTACT = {
    id: 'default_ta',
    name: 'Ta',
    avatar: 'https://picsum.photos/200/200?random=99'
  };

  // ==================== DOM ====================
  var chatContactArea   = document.getElementById('chatContactArea');
  var chatAvatar        = document.getElementById('chatAvatar');
  var chatName          = document.getElementById('chatName');

  var rolePanelModal    = document.getElementById('rolePanelModal');
  var roleListContainer = document.getElementById('roleListContainer');

  // 旧的"编辑资料"弹窗（保留 DOM 但不再触发）
  var editProfileModal  = document.getElementById('editProfileModal');

  if (!chatContactArea || !rolePanelModal || !roleListContainer) return;

  // ==================== 状态 ====================
  var contacts = [];
  var currentContactId = null;
  var pendingNewAvatarData = null;   // 新建角色时暂存的头像（dataURL 或 URL）
  var editingContactId = null;       // 当前正在编辑的联系人 id（null = 不在编辑态）
  var editingAvatarData = null;      // 编辑态下暂存的头像
  var myEditingAvatar = null;        // 「我的角色」编辑态下暂存的头像

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function genId() {
    return 'contact_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  // ==================== 数据读写 ====================
  function loadContacts() {
    try {
      var raw = localStorage.getItem(LS_CONTACTS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          contacts = arr.filter(function (c) { return c && c.id; });
        }
      }
    } catch (e) {}

    if (contacts.length === 0) {
      contacts = [Object.assign({}, DEFAULT_CONTACT)];
      saveContacts();
    }

    var cid = null;
    try { cid = localStorage.getItem(LS_CURRENT_KEY); } catch (e) {}
    if (cid && contacts.some(function (c) { return c.id === cid; })) {
      currentContactId = cid;
    } else {
      currentContactId = contacts[0].id;
      saveCurrentId();
    }
  }

  function saveContacts() {
    try { localStorage.setItem(LS_CONTACTS_KEY, JSON.stringify(contacts)); } catch (e) {}
  }
  function saveCurrentId() {
    try { localStorage.setItem(LS_CURRENT_KEY, currentContactId); } catch (e) {}
  }

  function getCurrentContact() {
    return contacts.find(function (c) { return c.id === currentContactId; }) || contacts[0];
  }

  // ==================== 同步顶栏 UI ====================
  function applyCurrentContact() {
    var c = getCurrentContact();
    if (!c) return;
    if (chatAvatar) chatAvatar.src = c.avatar || DEFAULT_CONTACT.avatar;
    if (chatName) chatName.textContent = c.name || 'Ta';
  }

  // ==================== 切换角色后的广播 ====================
  function broadcastContactChanged() {
    if (typeof window.refreshChatAvatars === 'function') {
      try { window.refreshChatAvatars(); } catch (e) {}
    }
    if (typeof window.refreshMoodPage === 'function') {
      try { window.refreshMoodPage(); } catch (e) {}
    }
    try {
      window.dispatchEvent(new CustomEvent('contactChanged', {
        detail: { contactId: currentContactId }
      }));
    } catch (e) {}
  }

  // ==================== 图片选择 ====================
  function pickImage(callback) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) { callback(ev.target.result); };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  // ==================== 「我的」资料读写 ====================
  function getMyProfile() {
    try {
      var raw = localStorage.getItem(MY_PROFILE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') return p;
      }
    } catch (e) {}
    // 默认：从主页读取（昵称取自主页 h1，头像取自主页头像）
    var name = '阿晏';
    var h1 = document.querySelector('#pageHome .header-card h1');
    if (h1 && h1.textContent && h1.textContent.trim()) name = h1.textContent.trim();
    var avatar = null;
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) avatar = avatarImg.src;
    else if (window.homeSettings && window.homeSettings.current && window.homeSettings.current.avatar) {
      avatar = window.homeSettings.current.avatar;
    }
    return { name: name, avatar: avatar };
  }

  function saveMyProfile(p) {
    try { localStorage.setItem(MY_PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
  }

  // ==================== 渲染面板 ====================
  function renderRolePanel() {
    applyCurrentContact();

    var cur = getCurrentContact();
    var isEditingCur = editingContactId === cur.id;
    var editAvatar = isEditingCur && editingAvatarData ? editingAvatarData : cur.avatar;

    var html = '';

    // ---------- 我的角色编辑区 ----------
    var my = getMyProfile();
    var myAvatarSrc = myEditingAvatar || my.avatar || DEFAULT_CONTACT.avatar;
    html += '<div class="rp-current-block rp-my-block">';
    html += '<div class="rp-current-title">我的角色</div>';
    html += '<div class="rp-edit-row">';
    html += '<div class="rp-edit-avatar-wrap" data-action="my-avatar">';
    html += '<img class="rp-edit-avatar" src="' + escapeHtml(myAvatarSrc) + '" alt="">';
    html += '<div class="rp-edit-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
    html += '</div>';
    html += '<input class="rp-edit-name" type="text" value="' + escapeHtml(my.name || '') + '" placeholder="我的昵称..." data-role="my-name">';
    html += '</div>';
    html += '<button class="rp-edit-save" data-action="save-my">保存我的资料</button>';
    html += '</div>';

    // ---------- 当前角色编辑区 ----------
    html += '<div class="rp-current-block">';
    html += '<div class="rp-current-title">当前角色</div>';
    html += '<div class="rp-edit-row">';
    html += '<div class="rp-edit-avatar-wrap" data-action="edit-avatar">';
    html += '<img class="rp-edit-avatar" src="' + escapeHtml(editAvatar || '') + '" alt="">';
    html += '<div class="rp-edit-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
    html += '</div>';
    html += '<input class="rp-edit-name" type="text" value="' + escapeHtml(cur.name) + '" placeholder="输入昵称..." data-role="cur-name">';
    html += '</div>';
    html += '<div class="rp-edit-url-row">';
    html += '<input class="rp-edit-url" type="text" placeholder="或粘贴图片 URL" data-role="cur-url">';
    html += '<button class="rp-edit-apply-url" data-action="apply-url">应用</button>';
    html += '</div>';
    html += '<button class="rp-edit-save" data-action="save-current">保存修改</button>';
    html += '</div>';

    // ---------- 所有角色列表 ----------
    html += '<div class="rp-list-title">所有角色</div>';
    html += '<div class="rp-list">';

    contacts.forEach(function (c) {
      var isCurrent = c.id === currentContactId;
      var cls = 'rp-item' + (isCurrent ? ' current' : '');
      html += '<div class="' + cls + '" data-id="' + escapeHtml(c.id) + '">';
      html += '<img class="rp-item-avatar" src="' + escapeHtml(c.avatar || '') + '" alt="">';
      html += '<div class="rp-item-info">';
      html += '<div class="rp-item-name">' + escapeHtml(c.name) + (isCurrent ? '<span class="rp-item-tag">当前</span>' : '') + '</div>';
      html += '</div>';
      if (isCurrent) {
        html += '<button class="rp-item-btn switch" disabled title="已选中"><i class="fa-solid fa-check"></i></button>';
      } else {
        html += '<button class="rp-item-btn switch" data-action="switch" title="切换"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>';
      }
      if (contacts.length > 1) {
        html += '<button class="rp-item-btn del" data-action="delete" title="删除"><i class="fa-solid fa-trash-can"></i></button>';
      }
      html += '</div>';
    });

    html += '</div>';

    // ---------- 底部：添加好友 + 新建区 + 关闭 ----------
    html += '<div class="rp-bottom-actions">';

    // 添加好友按钮
    html += '<button class="rp-new-toggle" data-action="toggle-new">';
    html += '<i class="fa-solid fa-plus"></i> 添加好友';
    html += '</button>';

    // 新建区（默认收起）
    html += '<div class="rp-new-body" style="display:none;">';
    html += '<div class="rp-edit-row">';
    html += '<div class="rp-edit-avatar-wrap" data-action="new-avatar">';
    var newAvatarSrc = pendingNewAvatarData || DEFAULT_CONTACT.avatar;
    html += '<img class="rp-edit-avatar" src="' + escapeHtml(newAvatarSrc) + '" alt="">';
    html += '<div class="rp-edit-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
    html += '</div>';
    html += '<input class="rp-edit-name" type="text" placeholder="输入好友姓名..." data-role="new-name">';
    html += '</div>';
    html += '<div class="rp-edit-url-row">';
    html += '<input class="rp-edit-url" type="text" placeholder="或粘贴图片 URL" data-role="new-url">';
    html += '<button class="rp-edit-apply-url" data-action="new-apply-url">应用</button>';
    html += '</div>';
    html += '<button class="rp-edit-save" data-action="create-new">创建好友</button>';
    html += '</div>';

    // 关闭按钮（满宽）
    html += '<button class="rp-close-full" data-action="close">';
    html += '<i class="fa-solid fa-xmark"></i> 关闭';
    html += '</button>';

    html += '</div>';

    roleListContainer.innerHTML = html;

    bindPanelEvents();
  }

  // ==================== 面板内事件绑定 ====================
  function bindPanelEvents() {
    // ---- 我的角色：头像上传 ----
    var myAvatarWrap = roleListContainer.querySelector('[data-action="my-avatar"]');
    if (myAvatarWrap) {
      myAvatarWrap.addEventListener('click', function () {
        pickImage(function (dataUrl) {
          myEditingAvatar = dataUrl;
          var img = roleListContainer.querySelector('[data-action="my-avatar"] .rp-edit-avatar');
          if (img) img.src = dataUrl;
        });
      });
    }

    // ---- 我的角色：保存我的资料 ----
    var saveMyBtn = roleListContainer.querySelector('[data-action="save-my"]');
    if (saveMyBtn) {
      saveMyBtn.addEventListener('click', function () {
        var nameInput = roleListContainer.querySelector('[data-role="my-name"]');
        var name = nameInput ? nameInput.value.trim() : '';
        if (!name) { alert('昵称不能为空'); return; }

        var profile = getMyProfile() || {};
        profile.name = name;
        if (myEditingAvatar) profile.avatar = myEditingAvatar;
        saveMyProfile(profile);
        myEditingAvatar = null;

        // 刷新聊天页「我」的头像昵称（单聊 + 群聊全局跟随）
        if (typeof window.refreshChatAvatars === 'function') {
          try { window.refreshChatAvatars(); } catch (e) {}
        }

        // 短暂提示"已保存"
        var btn = roleListContainer.querySelector('[data-action="save-my"]');
        if (btn) {
          var orig = btn.textContent;
          btn.textContent = '已保存 ✓';
          setTimeout(function () { if (btn) btn.textContent = orig; }, 1200);
        }
      });
    }

    // ---- 当前角色：头像上传 ----
    var curAvatarWrap = roleListContainer.querySelector('[data-action="edit-avatar"]');
    if (curAvatarWrap) {
      curAvatarWrap.addEventListener('click', function () {
        pickImage(function (dataUrl) {
          editingContactId = currentContactId;
          editingAvatarData = dataUrl;
          var img = roleListContainer.querySelector('[data-action="edit-avatar"] .rp-edit-avatar');
          if (img) img.src = dataUrl;
        });
      });
    }

    // ---- 当前角色：URL 应用 ----
    var curApplyBtn = roleListContainer.querySelector('[data-action="apply-url"]');
    if (curApplyBtn) {
      curApplyBtn.addEventListener('click', function () {
        var urlInput = roleListContainer.querySelector('[data-role="cur-url"]');
        var url = urlInput ? urlInput.value.trim() : '';
        if (!url) { alert('请粘贴图片 URL'); return; }
        editingContactId = currentContactId;
        editingAvatarData = url;
        var img = roleListContainer.querySelector('[data-action="edit-avatar"] .rp-edit-avatar');
        if (img) img.src = url;
      });
    }

    // ---- 当前角色：保存 ----
    var saveCurBtn = roleListContainer.querySelector('[data-action="save-current"]');
    if (saveCurBtn) {
      saveCurBtn.addEventListener('click', function () {
        var nameInput = roleListContainer.querySelector('[data-role="cur-name"]');
        var newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) { alert('昵称不能为空'); return; }

        var cur = getCurrentContact();
        if (!cur) return;
        cur.name = newName;
        if (editingContactId === cur.id && editingAvatarData) {
          cur.avatar = editingAvatarData;
        }
        saveContacts();

        applyCurrentContact();
        broadcastContactChanged();

        editingContactId = null;
        editingAvatarData = null;
        renderRolePanel();
      });
    }

    // ---- 列表项：点击切换 ----
    roleListContainer.querySelectorAll('.rp-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('[data-action]')) return;
        var id = item.getAttribute('data-id');
        if (id === currentContactId) return;
        switchContact(id);
      });
    });

    // ---- 列表项：切换按钮 ----
    roleListContainer.querySelectorAll('[data-action="switch"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = btn.closest('.rp-item');
        if (!item) return;
        var id = item.getAttribute('data-id');
        if (id === currentContactId) return;
        switchContact(id);
      });
    });

    // ---- 列表项：删除 ----
    roleListContainer.querySelectorAll('[data-action="delete"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = btn.closest('.rp-item');
        if (!item) return;
        var id = item.getAttribute('data-id');
        var target = contacts.find(function (c) { return c.id === id; });
        if (!target) return;
        if (!confirm('确定删除角色「' + target.name + '」？')) return;
        deleteContact(id);
      });
    });

    // ---- 添加好友：展开/收起 ----
    var toggleNewBtn = roleListContainer.querySelector('[data-action="toggle-new"]');
    if (toggleNewBtn) {
      toggleNewBtn.addEventListener('click', function () {
        var body = roleListContainer.querySelector('.rp-new-body');
        if (!body) return;
        var isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        // 收起时清空暂存
        if (isOpen) {
          pendingNewAvatarData = null;
        }
      });
    }

    // ---- 新角色：头像上传 ----
    var newAvatarWrap = roleListContainer.querySelector('[data-action="new-avatar"]');
    if (newAvatarWrap) {
      newAvatarWrap.addEventListener('click', function () {
        pickImage(function (dataUrl) {
          pendingNewAvatarData = dataUrl;
          var img = roleListContainer.querySelector('[data-action="new-avatar"] .rp-edit-avatar');
          if (img) img.src = dataUrl;
        });
      });
    }

    // ---- 新角色：URL 应用 ----
    var newApplyBtn = roleListContainer.querySelector('[data-action="new-apply-url"]');
    if (newApplyBtn) {
      newApplyBtn.addEventListener('click', function () {
        var urlInput = roleListContainer.querySelector('[data-role="new-url"]');
        var url = urlInput ? urlInput.value.trim() : '';
        if (!url) { alert('请粘贴图片 URL'); return; }
        pendingNewAvatarData = url;
        var img = roleListContainer.querySelector('[data-action="new-avatar"] .rp-edit-avatar');
        if (img) img.src = url;
      });
    }

    // ---- 新角色：创建 ----
    var createBtn = roleListContainer.querySelector('[data-action="create-new"]');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var nameInput = roleListContainer.querySelector('[data-role="new-name"]');
        var newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) { alert('请输入好友姓名'); return; }

        var newContact = {
          id: genId(),
          name: newName,
          avatar: pendingNewAvatarData || DEFAULT_CONTACT.avatar
        };
        contacts.push(newContact);
        saveContacts();

        currentContactId = newContact.id;
        saveCurrentId();

        pendingNewAvatarData = null;
        applyCurrentContact();
        broadcastContactChanged();

        renderRolePanel();
      });
    }

    // ---- 关闭按钮 ----
    var closeBtn = roleListContainer.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeRolePanel);
    }
  }

  // ==================== 切换 / 删除 ====================
  function switchContact(id) {
    currentContactId = id;
    saveCurrentId();
    editingContactId = null;
    editingAvatarData = null;
    applyCurrentContact();
    broadcastContactChanged();
    renderRolePanel();
  }

  function deleteContact(id) {
    if (contacts.length <= 1) {
      alert('至少保留一个角色');
      return;
    }
    contacts = contacts.filter(function (c) { return c.id !== id; });
    saveContacts();

    if (currentContactId === id) {
      currentContactId = contacts[0].id;
      saveCurrentId();
      applyCurrentContact();
      broadcastContactChanged();
    }

    renderRolePanel();
  }

  // ==================== 打开 / 关闭面板 ====================
  function openRolePanel() {
    renderRolePanel();
    rolePanelModal.classList.add('active');
  }

  function closeRolePanel() {
    rolePanelModal.classList.remove('active');
    editingContactId = null;
    editingAvatarData = null;
    pendingNewAvatarData = null;
    myEditingAvatar = null;
  }

   // ==================== 事件绑定 ====================
  // 聊天页点昵称：无操作（原"打开角色面板"入口已移除，只保留会话选择页右上角「＋」入口）
  // （单击头像由 chat-extras.js 处理，弹出"拍一拍"）

  // 点击遮罩关闭
  rolePanelModal.addEventListener('click', function (e) {
    if (e.target === rolePanelModal) closeRolePanel();
  });

  // 兜底：旧"编辑资料"弹窗（若打开）允许关闭
  if (editProfileModal) {
    var editCancel = document.getElementById('editCancelBtn');
    if (editCancel) {
      editCancel.addEventListener('click', function () {
        editProfileModal.classList.remove('active');
      });
    }
  }

  // ==================== 初始化 ====================
  function init() {
    loadContacts();
    applyCurrentContact();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部
  window.rolePanel = {
    open: openRolePanel,
    close: closeRolePanel,
    refresh: renderRolePanel,
    getCurrentContact: getCurrentContact,
    getContacts: function () { return contacts.slice(); },
    // 供会话选择页 / 外部直接切换当前角色（同步内存 + 存储 + 顶栏 + 广播）
    setCurrentContact: function (id) {
      if (!id) return false;
      if (!contacts.some(function (c) { return c.id === id; })) return false;
      currentContactId = id;
      saveCurrentId();
      applyCurrentContact();
      broadcastContactChanged();
      return true;
    }
  };

})();
