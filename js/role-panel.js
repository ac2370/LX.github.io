/* ============================================================
   role-panel.js —— 角色面板（多角色管理）
   功能：
     - 单击 #chatContactArea（头像+昵称区域）→ 打开角色面板
     - 面板分两块：
         · 「当前角色」编辑区（常驻）：改昵称、上传头像、粘贴 URL
         · 「其它角色」列表：点击切换、删除、新建
     - 数据存 localStorage：
         · my_contacts        [{id, name, avatar}]
         · my_current_contact 当前 id
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
  var DEFAULT_CONTACT = {
    id: 'default_ta',
    name: 'Ta',
    avatar: 'https://picsum.photos/200/200?random=99'
  };

  // ==================== DOM ====================
  var chatContactArea  = document.getElementById('chatContactArea');
  var chatAvatar       = document.getElementById('chatAvatar');
  var chatName         = document.getElementById('chatName');

  var rolePanelModal   = document.getElementById('rolePanelModal');
  var rolePanelClose   = document.getElementById('rolePanelCloseBtn');
  var roleListContainer = document.getElementById('roleListContainer');

  // 旧的"编辑资料"弹窗（保留 DOM 但不再触发）
  var editProfileModal = document.getElementById('editProfileModal');

  // 新角色区（原 HTML 里已有的）
  var roleNewAvatarWrap    = document.getElementById('roleNewAvatarWrap');
  var roleNewAvatarPreview = document.getElementById('roleNewAvatarPreview');
  var roleNewAvatarFile    = document.getElementById('roleNewAvatarFileInput');
  var roleNewNameInput     = document.getElementById('roleNewNameInput');
  var roleNewSaveBtn       = document.getElementById('roleNewSaveBtn');

  if (!chatContactArea || !rolePanelModal || !roleListContainer) return;

  // ==================== 状态 ====================
  var contacts = [];
  var currentContactId = null;
  var pendingNewAvatarData = null;   // 新建角色时暂存的头像（dataURL 或 URL）
  var editingContactId = null;       // 当前正在编辑的联系人 id（null = 不在编辑态）
  var editingAvatarData = null;      // 编辑态下暂存的头像

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
    // 通知消息头像模块刷新
    if (typeof window.refreshChatAvatars === 'function') {
      try { window.refreshChatAvatars(); } catch (e) {}
    }
    // 通知心晴手账刷新（如果当前在手账页）
    if (typeof window.refreshMoodPage === 'function') {
      try { window.refreshMoodPage(); } catch (e) {}
    }
    // 广播自定义事件（供未来扩展）
    try {
      window.dispatchEvent(new CustomEvent('contactChanged', {
        detail: { contactId: currentContactId }
      }));
    } catch (e) {}
  }

  // ==================== 图片选择（新建/编辑共用） ====================
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

  // ==================== 渲染面板 ====================
  function renderRolePanel() {
    // 顶栏同步
    applyCurrentContact();

    // -------- 当前角色编辑区 --------
    var cur = getCurrentContact();
    var isEditingCur = editingContactId === cur.id;
    var editAvatar = isEditingCur && editingAvatarData ? editingAvatarData : cur.avatar;

    var html = '';

    // 当前角色块（如果不在编辑态，显示"点击编辑"提示）
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

    // -------- 其它角色列表 --------
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

    // -------- 新建角色区（折叠式） --------
    html += '<div class="rp-new-block">';
    html += '<button class="rp-new-toggle" data-action="toggle-new">';
    html += '<i class="fa-solid fa-plus"></i> 新建角色';
    html += '</button>';
    html += '<div class="rp-new-body" style="display:none;">';
    html += '<div class="rp-edit-row">';
    html += '<div class="rp-edit-avatar-wrap" data-action="new-avatar">';
    var newAvatarSrc = pendingNewAvatarData || roleNewAvatarPreview && roleNewAvatarPreview.src || DEFAULT_CONTACT.avatar;
    html += '<img class="rp-edit-avatar" src="' + escapeHtml(newAvatarSrc) + '" alt="">';
    html += '<div class="rp-edit-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
    html += '</div>';
    html += '<input class="rp-edit-name" type="text" placeholder="输入角色姓名..." data-role="new-name">';
    html += '</div>';
    html += '<div class="rp-edit-url-row">';
    html += '<input class="rp-edit-url" type="text" placeholder="或粘贴图片 URL" data-role="new-url">';
    html += '<button class="rp-edit-apply-url" data-action="new-apply-url">应用</button>';
    html += '</div>';
    html += '<button class="rp-edit-save" data-action="create-new">创建角色</button>';
    html += '</div>';
    html += '</div>';

    roleListContainer.innerHTML = html;

    bindPanelEvents();
  }

  // ==================== 面板内事件绑定 ====================
  function bindPanelEvents() {
    // 头像（当前角色）
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

    // URL 应用（当前角色）
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

    // 保存当前角色
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

        // 同步 UI
        applyCurrentContact();
        broadcastContactChanged();

        // 重置编辑态
        editingContactId = null;
        editingAvatarData = null;
        renderRolePanel();
      });
    }

    // 列表项点击
    roleListContainer.querySelectorAll('.rp-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('[data-action]')) return;
        var id = item.getAttribute('data-id');
        if (id === currentContactId) return;
        switchContact(id);
      });
    });

    // 切换按钮
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

    // 删除按钮
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

    // 展开新建区
    var toggleNewBtn = roleListContainer.querySelector('[data-action="toggle-new"]');
    if (toggleNewBtn) {
      toggleNewBtn.addEventListener('click', function () {
        var body = roleListContainer.querySelector('.rp-new-body');
        if (!body) return;
        var isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
      });
    }

    // 新建头像
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

    // 新建 URL
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

    // 创建新角色
    var createBtn = roleListContainer.querySelector('[data-action="create-new"]');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        var nameInput = roleListContainer.querySelector('[data-role="new-name"]');
        var newName = nameInput ? nameInput.value.trim() : '';
        if (!newName) { alert('请输入角色姓名'); return; }

        var newContact = {
          id: genId(),
          name: newName,
          avatar: pendingNewAvatarData || DEFAULT_CONTACT.avatar
        };
        contacts.push(newContact);
        saveContacts();

        // 自动切到新角色
        currentContactId = newContact.id;
        saveCurrentId();

        pendingNewAvatarData = null;
        applyCurrentContact();
        broadcastContactChanged();

        // 重新渲染（新角色自动成为"当前"，新建区收起）
        renderRolePanel();
      });
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
    // 清理未保存的编辑态
    editingContactId = null;
    editingAvatarData = null;
    pendingNewAvatarData = null;
  }

  // ==================== 事件绑定 ====================
  // 单击顶栏头像/昵称 → 打开角色面板
  chatContactArea.addEventListener('click', function (e) {
    e.preventDefault();
    openRolePanel();
  });

  // 关闭
  if (rolePanelClose) {
    rolePanelClose.addEventListener('click', closeRolePanel);
  }
  rolePanelModal.addEventListener('click', function (e) {
    if (e.target === rolePanelModal) closeRolePanel();
  });

  // 兜底：如果旧的"编辑资料"弹窗被打开，也允许关闭（不影响本模块）
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

  // 暴露给外部（供未来扩展）
  window.rolePanel = {
    open: openRolePanel,
    close: closeRolePanel,
    refresh: renderRolePanel,
    getCurrentContact: getCurrentContact,
    getContacts: function () { return contacts.slice(); }
  };

})();
