/* ============================================================
   market.js —— 心意市集（钱包 + 商品库 + 购买送礼 + 心意柜 + 心愿单 + TA 自动送礼 + 礼物浮层）
   数据：
     - localforage 键 'giftWallet'
       { myBalance: 52000, systemBalance: 52000 }   // 单位：分
     - localforage 键 'giftboxItems_<contactId>'
       [ { id, giftId, name, price, emoji, wish, side: 'in'|'out'|'self',
           claimed, tm } ]
     - localforage 键 'giftWishlist_<contactId>'         // 我的心愿单
     - localforage 键 'giftWishlistTa_<contactId>'       // TA 的心愿单
     - localforage 键 'giftWishlistTaInited_<contactId>' // TA 心愿单是否已初始化标记
     - localforage 键 'marketSettings'
       { autoGiftProbability, dailyLimit, replyProbability }
   依赖：
     - window.showPage / window.pageMarket / window.pageHome
     - window.chatAddGift / window.chatAddTextMessage（chat.js 提供）
     - window.getReplyCards（card.js 提供）
     - localStorage: my_contacts / my_current_contact
   ============================================================ */
(function () {
  'use strict';

  console.log('market loaded');

  // ==================== 常量 ====================
  var STORE_KEY_WALLET = 'giftWallet';
  var STORE_KEY_SETTINGS = 'marketSettings';
  var LS_CONTACTS_KEY  = 'my_contacts';
  var LS_CURRENT_KEY   = 'my_current_contact';
  var LS_AUTO_GIFT_DAY = 'marketAutoGiftDay';
  var LS_GIFT_UNREAD_DOT = 'market_gift_unread_dot';

  var DEFAULT_WALLET = {
    myBalance: 52000,
    systemBalance: 52000
  };

  var DEFAULT_SETTINGS = {
    autoGiftProbability: 0.30,
    dailyLimit: 3,
    replyProbability: 0.7
  };

  var DEFAULT_CONTACT = {
    id: 'default_ta',
    name: 'Ta',
    avatar: 'https://picsum.photos/200/200?random=99'
  };

  // ★ 测试用：自动送礼间隔 30 秒
  //   正式上线：30 * 60 * 1000 ~ 90 * 60 * 1000
  var AUTO_GIFT_MIN = 30 * 1000;
  var AUTO_GIFT_MAX = 30 * 1000;

  var BRANCH_BUY_MY_WISH   = 0.20;
  var BRANCH_BUY_SELF      = 0.10;

  // ==================== 分类 ====================
  var CATEGORIES = [
    { key: 'flower',  emoji: '💐', name: '花束' },
    { key: 'dessert', emoji: '🍰', name: '甜品' },
    { key: 'drink',   emoji: '🧋', name: '饮品' },
    { key: 'jewelry', emoji: '💍', name: '饰品' },
    { key: 'star',    emoji: '🌟', name: '星空' },
    { key: 'travel',  emoji: '✈️', name: '出行' },
    { key: 'fun',     emoji: '🎮', name: '娱乐' },
    { key: 'care',    emoji: '🧸', name: '关怀' },
    { key: 'daily',   emoji: '🧴', name: '日常' },
    { key: 'medicine',emoji: '💊', name: '药品' }
  ];

  // ==================== 商品库 ====================
  var DEFAULT_GIFTS = [
    { id: 'flower_1', name: '一朵小花',       price: 1000,  emoji: '🌷', category: 'flower' },
    { id: 'flower_2', name: '满天星',         price: 3000,  emoji: '💐', category: 'flower' },
    { id: 'flower_3', name: '红玫瑰花束',     price: 8000,  emoji: '🌹', category: 'flower' },
    { id: 'flower_4', name: '郁金香',         price: 12000, emoji: '🌷', category: 'flower' },
    { id: 'flower_5', name: '向日葵',         price: 15000, emoji: '🌻', category: 'flower' },
    { id: 'flower_6', name: '蓝色妖姬',       price: 26000, emoji: '💙', category: 'flower' },
    { id: 'flower_7', name: '蓝色绣球',       price: 32000, emoji: '🌺', category: 'flower' },
    { id: 'flower_8', name: '白色铃兰',       price: 52000, emoji: '🌼', category: 'flower' },

    { id: 'dessert_1', name: '布丁',           price: 1000,  emoji: '🍮', category: 'dessert' },
    { id: 'dessert_2', name: '马卡龙',         price: 3000,  emoji: '🍬', category: 'dessert' },
    { id: 'dessert_3', name: '甜甜圈',         price: 5000,  emoji: '🍩', category: 'dessert' },
    { id: 'dessert_4', name: '草莓蛋糕',       price: 12000, emoji: '🍰', category: 'dessert' },
    { id: 'dessert_5', name: '芝士蛋糕',       price: 16000, emoji: '🎂', category: 'dessert' },
    { id: 'dessert_6', name: '手工巧克力',     price: 22000, emoji: '🍫', category: 'dessert' },
    { id: 'dessert_7', name: '定制生日蛋糕',   price: 48000, emoji: '🎂', category: 'dessert' },

    { id: 'drink_1', name: '柠檬水',           price: 1000,  emoji: '🍋', category: 'drink' },
    { id: 'drink_2', name: '美式咖啡',         price: 3000,  emoji: '☕', category: 'drink' },
    { id: 'drink_3', name: '珍珠奶茶',         price: 4000,  emoji: '🧋', category: 'drink' },
    { id: 'drink_4', name: '抹茶拿铁',         price: 6000,  emoji: '🍵', category: 'drink' },
    { id: 'drink_5', name: '鲜榨橙汁',         price: 8000,  emoji: '🍊', category: 'drink' },
    { id: 'drink_6', name: '香槟',             price: 32000, emoji: '🍾', category: 'drink' },
    { id: 'drink_7', name: '精酿红酒',         price: 52000, emoji: '🍷', category: 'drink' },

    { id: 'jewelry_1', name: '发绳',           price: 1000,  emoji: '🎀', category: 'jewelry' },
    { id: 'jewelry_2', name: '耳钉',           price: 5000,  emoji: '💠', category: 'jewelry' },
    { id: 'jewelry_3', name: '手链',           price: 12000, emoji: '📿', category: 'jewelry' },
    { id: 'jewelry_4', name: '银戒指',         price: 26000, emoji: '💍', category: 'jewelry' },
    { id: 'jewelry_5', name: '锁骨链',         price: 32000, emoji: '⛓️', category: 'jewelry' },
    { id: 'jewelry_6', name: '珍珠耳环',       price: 42000, emoji: '💎', category: 'jewelry' },
    { id: 'jewelry_7', name: '钻戒',           price: 52000, emoji: '💍', category: 'jewelry' },

    { id: 'star_1', name: '一颗流星',         price: 5000,  emoji: '🌠', category: 'star' },
    { id: 'star_2', name: '许愿星',           price: 8000,  emoji: '⭐', category: 'star' },
    { id: 'star_3', name: '一轮月亮',         price: 15000, emoji: '🌙', category: 'star' },
    { id: 'star_4', name: '满天繁星',         price: 28000, emoji: '✨', category: 'star' },
    { id: 'star_5', name: '整片银河',         price: 45000, emoji: '🌌', category: 'star' },
    { id: 'star_6', name: '属于你的星座',     price: 52000, emoji: '🌟', category: 'star' },

    { id: 'travel_1', name: '一次散步',       price: 1000,  emoji: '🚶', category: 'travel' },
    { id: 'travel_2', name: '一场电影',       price: 8000,  emoji: '🎬', category: 'travel' },
    { id: 'travel_3', name: '周末一日游',     price: 18000, emoji: '🚗', category: 'travel' },
    { id: 'travel_4', name: '火车票',         price: 22000, emoji: '🚆', category: 'travel' },
    { id: 'travel_5', name: '机票',           price: 48000, emoji: '✈️', category: 'travel' },
    { id: 'travel_6', name: '海岛度假',       price: 52000, emoji: '🏝️', category: 'travel' },

    { id: 'fun_1', name: '一句晚安',         price: 1000,  emoji: '🌙', category: 'fun' },
    { id: 'fun_2', name: '一起打游戏',       price: 6000,  emoji: '🎮', category: 'fun' },
    { id: 'fun_3', name: '演唱会门票',       price: 26000, emoji: '🎤', category: 'fun' },
    { id: 'fun_4', name: '游乐园一日游',     price: 32000, emoji: '🎡', category: 'fun' },
    { id: 'fun_5', name: '定制歌曲',         price: 42000, emoji: '🎵', category: 'fun' },
    { id: 'fun_6', name: '一张 VIP 门票',    price: 52000, emoji: '🎫', category: 'fun' },

    { id: 'care_1', name: '一个拥抱',         price: 1000,  emoji: '🤗', category: 'care' },
    { id: 'care_2', name: '一句关心',         price: 2000,  emoji: '💌', category: 'care' },
    { id: 'care_3', name: '热水袋',           price: 6000,  emoji: '🌡️', category: 'care' },
    { id: 'care_4', name: '毛绒玩偶',         price: 12000, emoji: '🧸', category: 'care' },
    { id: 'care_5', name: '按摩一次',         price: 22000, emoji: '💆', category: 'care' },
    { id: 'care_6', name: '陪伴一整天',       price: 52000, emoji: '💝', category: 'care' },

    { id: 'daily_1', name: '一支牙膏',         price: 1000,  emoji: '🪥', category: 'daily' },
    { id: 'daily_2', name: '一支洗面奶',       price: 4000,  emoji: '🧴', category: 'daily' },
    { id: 'daily_3', name: '一包纸巾',         price: 5000,  emoji: '🧻', category: 'daily' },
    { id: 'daily_4', name: '一把雨伞',         price: 8000,  emoji: '☂️', category: 'daily' },
    { id: 'daily_5', name: '一个保温杯',       price: 12000, emoji: '🥤', category: 'daily' },
    { id: 'daily_6', name: '一份下午茶',       price: 18000, emoji: '🍱', category: 'daily' },
    { id: 'daily_7', name: '一周外卖卡',       price: 26000, emoji: '🍜', category: 'daily' },

    { id: 'medicine_1', name: '创可贴',         price: 1000,  emoji: '🩹', category: 'medicine' },
    { id: 'medicine_2', name: '维生素',         price: 5000,  emoji: '💊', category: 'medicine' },
    { id: 'medicine_3', name: '感冒药',         price: 8000,  emoji: '💊', category: 'medicine' },
    { id: 'medicine_4', name: '退烧贴',         price: 6000,  emoji: '🧊', category: 'medicine' },
    { id: 'medicine_5', name: '眼药水',         price: 5000,  emoji: '💧', category: 'medicine' },
    { id: 'medicine_6', name: '胃药',           price: 9000,  emoji: '💊', category: 'medicine' },
    { id: 'medicine_7', name: '一次体检',       price: 52000, emoji: '🏥', category: 'medicine' }
  ];

  // ==================== DOM ====================
  var btnMarket   = document.getElementById('btnMarket');
  var mktBackBtn  = document.getElementById('mktBackBtn');
  var mktWalletBtn = document.getElementById('mktWalletBtn');
  var mktWalletAmount = document.getElementById('mktWalletAmount');

  var mktTabs  = document.querySelectorAll('.mkt-tab');
  var mktViews = {
    shop:     document.getElementById('mktViewShop'),
    cabinet:  document.getElementById('mktViewCabinet'),
    wishlist: document.getElementById('mktViewWishlist')
  };

  var mktCategories = document.getElementById('mktCategories');
  var mktGoodsGrid  = document.getElementById('mktGoodsGrid');
  var mktGoodsEmpty = document.getElementById('mktGoodsEmpty');

  var mktStatFromTa = document.getElementById('mktStatFromTa');
  var mktStatToTa   = document.getElementById('mktStatToTa');
  var mktStatTaSelf = document.getElementById('mktStatTaSelf');

  var mktRecords      = document.getElementById('mktRecords');
  var mktRecordsEmpty = document.getElementById('mktRecordsEmpty');

  var mktWishes      = document.getElementById('mktWishes');
  var mktWishesEmpty = document.getElementById('mktWishesEmpty');

  // ==================== 状态 ====================
  var wallet = Object.assign({}, DEFAULT_WALLET);
  var walletReady = false;

  var settings = Object.assign({}, DEFAULT_SETTINGS);
  var settingsReady = false;

  var currentCategory = CATEGORIES[0].key;
  var currentSubTab = 'fromTa';
  var currentWishTab = 'myWish';

  var currentContactId = null;
  var currentContact   = null;

  var boxItems = [];
  var boxReady = false;

  var myWishes = [];
  var taWishes = [];
  var wishesReady = false;

  var autoGiftTimer = null;
  var autoGiftScheduled = false;

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function formatPrice(cents) {
    var n = Number(cents) || 0;
    var yuan = n / 100;
    if (yuan === Math.floor(yuan)) return '¥' + yuan;
    return '¥' + yuan.toFixed(2);
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var y = d.getFullYear();
    var m = (d.getMonth() + 1).toString().padStart(2, '0');
    var dd = d.getDate().toString().padStart(2, '0');
    var hh = d.getHours().toString().padStart(2, '0');
    var mm = d.getMinutes().toString().padStart(2, '0');
    return y + '.' + m + '.' + dd + ' ' + hh + ':' + mm;
  }

  // ==================== 未读礼物红点 ====================
  function showGiftUnreadDot() {
    try { localStorage.setItem(LS_GIFT_UNREAD_DOT, '1'); } catch (e) {}
    applyGiftUnreadDot();
  }
  function clearGiftUnreadDot() {
    try { localStorage.removeItem(LS_GIFT_UNREAD_DOT); } catch (e) {}
    applyGiftUnreadDot();
  }
  function applyGiftUnreadDot() {
    if (!btnMarket) return;
    var has = false;
    try { has = localStorage.getItem(LS_GIFT_UNREAD_DOT) === '1'; } catch (e) {}
    var dot = btnMarket.querySelector('.market-unread-dot');
    if (has) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'market-unread-dot';
        btnMarket.appendChild(dot);
      }
    } else {
      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
    }
  }

  // ==================== 礼物浮层提示 ====================
  function showGiftToast(text) {
    var old = document.getElementById('marketGiftToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var toast = document.createElement('div');
    toast.id = 'marketGiftToast';
    toast.innerHTML =
      '<div class="market-gift-toast-inner">' +
        '<div class="market-gift-toast-icon">🎁</div>' +
        '<div class="market-gift-toast-text">' + escapeHtml(text) + '</div>' +
      '</div>';

    toast.style.cssText =
      'position:fixed;left:50%;bottom:-200px;transform:translateX(-50%);' +
      'z-index:600;width:calc(100% - 32px);max-width:400px;' +
      'transition:bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);' +
      'cursor:pointer;';

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.style.bottom = '24px';
    });

    var autoTimer = setTimeout(function () { removeToast(); }, 8000);

    function removeToast() {
      clearTimeout(autoTimer);
      toast.style.bottom = '-200px';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }

    toast.addEventListener('click', removeToast);
  }

  // ==================== 联系人 ====================
  function loadContacts() {
    try {
      var raw = localStorage.getItem(LS_CONTACTS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.filter(function (c) { return c && c.id; });
        }
      }
    } catch (e) {}
    return [Object.assign({}, DEFAULT_CONTACT)];
  }

  function resolveCurrentContact() {
    var contacts = loadContacts();
    var cid = null;
    try { cid = localStorage.getItem(LS_CURRENT_KEY); } catch (e) {}
    if (cid && contacts.some(function (c) { return c.id === cid; })) {
      currentContactId = cid;
    } else {
      currentContactId = contacts[0].id;
    }
    currentContact = contacts.find(function (c) { return c.id === currentContactId; }) || contacts[0];
  }

  function boxKey()              { return 'giftboxItems_' + (currentContactId || 'default'); }
  function wishlistKey()         { return 'giftWishlist_' + (currentContactId || 'default'); }
  function wishlistTaKey()       { return 'giftWishlistTa_' + (currentContactId || 'default'); }
  function wishlistTaInitedKey() { return 'giftWishlistTaInited_' + (currentContactId || 'default'); }

  // ==================== 钱包 ====================
  function loadWallet() {
    if (typeof localforage === 'undefined') {
      walletReady = true;
      return Promise.resolve();
    }
    return localforage.getItem(STORE_KEY_WALLET).then(function (data) {
      if (data && typeof data === 'object') {
        wallet.myBalance     = Number(data.myBalance)     || 0;
        wallet.systemBalance = Number(data.systemBalance) || 0;
      } else {
        wallet = Object.assign({}, DEFAULT_WALLET);
        return localforage.setItem(STORE_KEY_WALLET, wallet);
      }
    }).then(function () {
      walletReady = true;
      updateWalletUI();
    }).catch(function () {
      walletReady = true;
      updateWalletUI();
    });
  }

  function saveWallet() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(STORE_KEY_WALLET, wallet).catch(function (e) {
      console.warn('[market] 钱包保存失败', e);
    });
  }

  function updateWalletUI() {
    if (mktWalletAmount) {
      mktWalletAmount.textContent = formatPrice(wallet.myBalance);
    }
  }

  // ==================== 设置 ====================
  function loadSettings() {
    if (typeof localforage === 'undefined') {
      settingsReady = true;
      return Promise.resolve();
    }
    return localforage.getItem(STORE_KEY_SETTINGS).then(function (data) {
      if (data && typeof data === 'object') {
        settings = Object.assign({}, DEFAULT_SETTINGS, data);
      }
      settingsReady = true;
    }).catch(function () {
      settingsReady = true;
    });
  }

  function saveSettings() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(STORE_KEY_SETTINGS, settings).catch(function () {});
  }

  // ==================== 心意柜数据 ====================
  function loadBox() {
    if (typeof localforage === 'undefined') {
      boxReady = true;
      return Promise.resolve();
    }
    return localforage.getItem(boxKey()).then(function (data) {
      boxItems = Array.isArray(data) ? data : [];
      boxReady = true;
    }).catch(function () {
      boxItems = [];
      boxReady = true;
    });
  }

  function saveBox() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(boxKey(), boxItems).catch(function (e) {
      console.warn('[market] 心意柜保存失败', e);
    });
  }

  // ==================== 心愿单数据 ====================
  function loadWishes() {
    if (typeof localforage === 'undefined') {
      wishesReady = true;
      return Promise.resolve();
    }
    return Promise.all([
      localforage.getItem(wishlistKey()),
      localforage.getItem(wishlistTaKey()),
      localforage.getItem(wishlistTaInitedKey())
    ]).then(function (results) {
      myWishes = Array.isArray(results[0]) ? results[0] : [];
      taWishes = Array.isArray(results[1]) ? results[1] : [];
      var taInited = results[2] === true;

      if (!taInited) {
        taWishes = generateRandomTaWishes();
        return Promise.all([
          localforage.setItem(wishlistKey(), myWishes),
          localforage.setItem(wishlistTaKey(), taWishes),
          localforage.setItem(wishlistTaInitedKey(), true)
        ]);
      }
    }).then(function () {
      wishesReady = true;
    }).catch(function () {
      wishesReady = true;
    });
  }

  function saveWishes() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return Promise.all([
      localforage.setItem(wishlistKey(), myWishes),
      localforage.setItem(wishlistTaKey(), taWishes)
    ]).catch(function (e) {
      console.warn('[market] 心愿单保存失败', e);
    });
  }

  function generateRandomTaWishes() {
    var arr = [];
    var count = randomInt(3, 6);
    var now = Date.now();
    var THIRTY_DAYS = 30 * 24 * 3600 * 1000;
    for (var i = 0; i < count; i++) {
      var g = randomPick(DEFAULT_GIFTS);
      if (!g) continue;
      var offset = Math.floor(Math.random() * THIRTY_DAYS);
      arr.push({
        id: genId('wishTa'),
        giftId: g.id,
        name: g.name,
        price: g.price,
        emoji: g.emoji,
        wish: '',
        tm: now - offset
      });
    }
    return arr;
  }

  // ==================== 钱包修改弹窗（双输入框） ====================
  function openWalletModal() {
    var old = document.getElementById('mktWalletModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var modal = document.createElement('div');
    modal.id = 'mktWalletModal';
    modal.className = 'mkt-modal';
    modal.innerHTML =
      '<div class="mkt-panel">' +
        '<div class="mkt-panel-title">修改心意币余额</div>' +
        '<div class="mkt-setting-row">' +
          '<label class="mkt-setting-label">我的心意币（¥）</label>' +
          '<input type="number" class="mkt-panel-input" id="mktWalletMyInput" placeholder="我的心意币（¥）" value="' +
            (wallet.myBalance / 100) + '">' +
        '</div>' +
        '<div class="mkt-setting-row">' +
          '<label class="mkt-setting-label">Ta 的心意币（¥）</label>' +
          '<input type="number" class="mkt-panel-input" id="mktWalletTaInput" placeholder="Ta 的心意币（¥）" value="' +
            (wallet.systemBalance / 100) + '">' +
        '</div>' +
        '<div class="mkt-panel-actions">' +
          '<button class="mkt-btn mkt-btn-cancel" id="mktWalletCancel">取消</button>' +
          '<button class="mkt-btn mkt-btn-confirm" id="mktWalletConfirm">保存</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    function closeModal() {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }

    document.getElementById('mktWalletCancel').addEventListener('click', closeModal);
    document.getElementById('mktWalletConfirm').addEventListener('click', function () {
      var myInput = document.getElementById('mktWalletMyInput');
      var taInput = document.getElementById('mktWalletTaInput');
      var myVal = parseFloat(myInput.value);
      var taVal = parseFloat(taInput.value);
      if (isNaN(myVal) || myVal < 0) { alert('请填写有效的心意币'); return; }
      if (isNaN(taVal) || taVal < 0) { alert('请填写有效的 Ta 心意币'); return; }
      wallet.myBalance     = Math.round(myVal * 100);
      wallet.systemBalance = Math.round(taVal * 100);
      saveWallet().then(function () {
        updateWalletUI();
        closeModal();
      });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  // ==================== 分类渲染 ====================
  function renderCategories() {
    if (!mktCategories) return;
    var html = '';
    CATEGORIES.forEach(function (cat) {
      var active = cat.key === currentCategory ? ' active' : '';
      html += '<button class="mkt-cat-btn' + active + '" data-cat="' + cat.key + '">' +
        '<span class="mkt-cat-icon">' + cat.emoji + '</span>' +
        '<span class="mkt-cat-label">' + escapeHtml(cat.name) + '</span>' +
        '</button>';
    });
    mktCategories.innerHTML = html;

    mktCategories.querySelectorAll('.mkt-cat-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-cat');
        if (key === currentCategory) return;
        currentCategory = key;
        renderCategories();
        renderGoods();
      });
    });
  }

  // ==================== 商品渲染 ====================
  function renderGoods() {
    if (!mktGoodsGrid) return;
    var goods = DEFAULT_GIFTS.filter(function (g) { return g.category === currentCategory; });

    if (goods.length === 0) {
      mktGoodsGrid.innerHTML = '';
      if (mktGoodsEmpty) mktGoodsEmpty.style.display = 'block';
      return;
    }
    if (mktGoodsEmpty) mktGoodsEmpty.style.display = 'none';

    var html = '';
    goods.forEach(function (g) {
      html += '<div class="mkt-good-card" data-id="' + escapeHtml(g.id) + '">' +
        '<div class="mkt-good-img">' + escapeHtml(g.emoji) + '</div>' +
        '<div class="mkt-good-name">' + escapeHtml(g.name) + '</div>' +
        '<div class="mkt-good-price">' + formatPrice(g.price) + '</div>' +
        '</div>';
    });
    mktGoodsGrid.innerHTML = html;

    mktGoodsGrid.querySelectorAll('.mkt-good-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-id');
        openBuyModal(id);
      });
    });
  }

  // ==================== 购买弹窗 ====================
  function openBuyModal(giftId) {
    var gift = DEFAULT_GIFTS.find(function (g) { return g.id === giftId; });
    if (!gift) return;

    var old = document.getElementById('mktBuyModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var modal = document.createElement('div');
    modal.id = 'mktBuyModal';
    modal.className = 'mkt-modal';
    modal.innerHTML =
      '<div class="mkt-panel">' +
        '<div class="mkt-panel-title">送出心意</div>' +
        '<div class="mkt-buy-preview">' +
          '<div class="mkt-buy-emoji">' + escapeHtml(gift.emoji) + '</div>' +
          '<div class="mkt-buy-info">' +
            '<div class="mkt-buy-name">' + escapeHtml(gift.name) + '</div>' +
            '<div class="mkt-buy-price">' + formatPrice(gift.price) + '</div>' +
          '</div>' +
        '</div>' +
        '<textarea class="mkt-buy-wish" id="mktBuyWish" maxlength="60" placeholder="写一句心意（60 字以内）..."></textarea>' +
        '<div class="mkt-buy-actions">' +
          '<button class="mkt-btn mkt-btn-cancel" id="mktBuyCancel">取消</button>' +
          '<button class="mkt-btn mkt-btn-wish" id="mktBuyWishBtn">♡ 加入心愿单</button>' +
          '<button class="mkt-btn mkt-btn-confirm" id="mktBuySend">送给 Ta</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    function closeModal() {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }

    document.getElementById('mktBuyCancel').addEventListener('click', closeModal);

    document.getElementById('mktBuyWishBtn').addEventListener('click', function () {
      addWishFromGift(gift);
      closeModal();
    });

    document.getElementById('mktBuySend').addEventListener('click', function () {
      var wish = document.getElementById('mktBuyWish').value.trim();
      buyAndSend(gift, wish).then(function (ok) {
        if (ok) closeModal();
      });
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  // ==================== 购买送礼 ====================
  function buyAndSend(gift, wish) {
    if (!gift) return Promise.resolve(false);

    if (wallet.myBalance < gift.price) {
      alert('心意币不足，需要 ' + formatPrice(gift.price - wallet.myBalance) + ' 才能送出');
      return Promise.resolve(false);
    }

    wallet.myBalance -= gift.price;
    updateWalletUI();

    var record = {
      id: genId('box'),
      giftId: gift.id,
      name: gift.name,
      price: gift.price,
      emoji: gift.emoji,
      wish: wish || '',
      side: 'out',
      claimed: true,
      tm: Date.now()
    };
    boxItems.push(record);

    // ★ 关键：先同步渲染聊天礼物卡（不依赖 Promise），再保存
    try {
      if (typeof window.chatAddGift === 'function') {
        window.chatAddGift(record);
      } else {
        console.warn('[market] chatAddGift 未定义，跳过聊天渲染');
      }
    } catch (e) {
      console.warn('[market] chatAddGift 调用失败', e);
    }

    // 再保存 + 刷新心意柜
    saveWallet();
    saveBox();
    renderBox();

    // TA 回复
    scheduleTaReplyToGift('out');

    // 浮层 + 红点
    showGiftToast('礼物已送出，Ta 会收到的');
    showGiftUnreadDot();

    return Promise.resolve(true);
  }

  // ==================== TA 回复 ====================
  function scheduleTaReplyToGift(kind, specialText) {
    if (Math.random() > settings.replyProbability) return;

    var delay = 1000 + Math.floor(Math.random() * 2000);
    setTimeout(function () {
      var pool = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
      var reply;
      if (specialText) {
        reply = specialText;
      } else if (Array.isArray(pool) && pool.length > 0) {
        reply = randomPick(pool);
      }
      if (!reply) return;

      if (typeof window.chatAddTextMessage === 'function') {
        try { window.chatAddTextMessage('other', reply); } catch (e) {}
      } else {
        var chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
          var row = document.createElement('div');
          row.className = 'message-row other';
          var bubble = document.createElement('div');
          bubble.className = 'message-bubble';
          bubble.textContent = reply;
          row.appendChild(bubble);
          chatMessages.appendChild(row);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }
    }, delay);
  }

  // ==================== 加入心愿单 ====================
  function addWishFromGift(gift) {
    if (!gift) return;
    if (myWishes.length >= 30) {
      alert('我的心愿单最多 30 件');
      return;
    }
    if (myWishes.some(function (w) { return w.giftId === gift.id; })) {
      alert('这件礼物已经在你的心愿单里了');
      return;
    }
    myWishes.push({
      id: genId('wish'),
      giftId: gift.id,
      name: gift.name,
      price: gift.price,
      emoji: gift.emoji,
      wish: '',
      tm: Date.now()
    });
    saveWishes().then(function () {
      renderWishes();
      alert('已加入心愿单');
    });
  }

  // ==================== 心意柜渲染 ====================
  function renderStats() {
    var countIn = 0, countOut = 0, countSelf = 0;
    boxItems.forEach(function (it) {
      if (it.side === 'in') countIn++;
      else if (it.side === 'out') countOut++;
      else if (it.side === 'self') countSelf++;
    });
    if (mktStatFromTa) mktStatFromTa.textContent = countIn;
    if (mktStatToTa)   mktStatToTa.textContent   = countOut;
    if (mktStatTaSelf) mktStatTaSelf.textContent = countSelf;
  }

  function renderBox() {
    renderStats();
    if (!mktRecords) return;

    var arr = boxItems.slice().filter(function (it) {
      if (currentSubTab === 'fromTa') return it.side === 'in';
      if (currentSubTab === 'toTa')   return it.side === 'out';
      if (currentSubTab === 'taSelf') return it.side === 'self';
      return false;
    }).sort(function (a, b) { return (b.tm || 0) - (a.tm || 0); });

    if (arr.length === 0) {
      mktRecords.innerHTML = '';
      if (mktRecordsEmpty) mktRecordsEmpty.style.display = 'block';
      return;
    }
    if (mktRecordsEmpty) mktRecordsEmpty.style.display = 'none';

    var html = '';
    arr.forEach(function (it) {
      var claimTag = '';
      // 只有 Ta 送我的（side: 'in'）且未领取时才显示"待领取"角标
      if (it.side === 'in' && !it.claimed) {
        claimTag = '<span class="mkt-record-claim" data-claim="' + escapeHtml(it.id) + '">待领取</span>';
      }
      html += '<div class="mkt-record-card" data-id="' + escapeHtml(it.id) + '">' +
        '<div class="mkt-record-icon">' + escapeHtml(it.emoji) + '</div>' +
        '<div class="mkt-record-info">' +
          '<div class="mkt-record-name">' + escapeHtml(it.name) + claimTag + '</div>' +
          (it.wish ? '<div class="mkt-record-wish">' + escapeHtml(it.wish) + '</div>' : '') +
          '<div class="mkt-record-time">' + formatTime(it.tm) + '</div>' +
        '</div>' +
        '<div class="mkt-record-price">' + formatPrice(it.price) + '</div>' +
        '<button class="mkt-wish-del" data-del="' + escapeHtml(it.id) + '"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>';
    });
    mktRecords.innerHTML = html;

    mktRecords.querySelectorAll('[data-claim]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = el.getAttribute('data-claim');
        claimRecord(id);
      });
    });
    mktRecords.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-del');
        if (!confirm('删除这条记录吗？')) return;
        boxItems = boxItems.filter(function (it) { return it.id !== id; });
        saveBox().then(function () { renderBox(); });
      });
    });
  }

  function claimRecord(id) {
    var it = boxItems.find(function (x) { return x.id === id; });
    if (!it) return;
    it.claimed = true;
    saveBox().then(function () {
      renderBox();
      if (typeof window.chatMarkGiftClaimed === 'function') {
        try { window.chatMarkGiftClaimed(id); } catch (e) {}
      }
    });
  }

  // ==================== 心愿单渲染 ====================
  function renderWishes() {
    if (!mktWishes) return;
    var list = currentWishTab === 'myWish' ? myWishes : taWishes;

    if (!list || list.length === 0) {
      mktWishes.innerHTML = '';
      if (mktWishesEmpty) {
        mktWishesEmpty.style.display = 'block';
        var txtEl = mktWishesEmpty.querySelector('.mkt-empty-text');
        if (txtEl) txtEl.textContent = (currentWishTab === 'myWish' ? '我还没有心愿' : 'Ta 还没有心愿');
      }
      return;
    }
    if (mktWishesEmpty) mktWishesEmpty.style.display = 'none';

    var html = '';
    list.slice().sort(function (a, b) { return (b.tm || 0) - (a.tm || 0); }).forEach(function (w) {
      var delBtn = '';
      if (currentWishTab === 'myWish') {
        delBtn = '<button class="mkt-wish-del" data-del="' + escapeHtml(w.id) + '"><i class="fa-solid fa-xmark"></i></button>';
      }
      html += '<div class="mkt-wish-card" data-id="' + escapeHtml(w.id) + '">' +
        '<div class="mkt-wish-icon">' + escapeHtml(w.emoji) + '</div>' +
        '<div class="mkt-wish-info">' +
          '<div class="mkt-wish-name">' + escapeHtml(w.name) + '</div>' +
          '<div class="mkt-wish-time">' + formatTime(w.tm) + '</div>' +
        '</div>' +
        '<div class="mkt-wish-price">' + formatPrice(w.price) + '</div>' +
        delBtn +
        '</div>';
    });
    mktWishes.innerHTML = html;

    mktWishes.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-del');
        if (!confirm('从心愿单删除？')) return;
        myWishes = myWishes.filter(function (w) { return w.id !== id; });
        saveWishes().then(function () { renderWishes(); });
      });
    });
  }

  // ==================== TA 自动送礼 ====================
  function getAutoGiftDay() {
    var today = new Date().toISOString().slice(0, 10);
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_AUTO_GIFT_DAY) || 'null'); } catch (e) {}
    if (!raw || raw.date !== today) {
      raw = { date: today, count: 0 };
      try { localStorage.setItem(LS_AUTO_GIFT_DAY, JSON.stringify(raw)); } catch (e) {}
    }
    return raw;
  }

  function bumpAutoGiftDay() {
    var d = getAutoGiftDay();
    d.count += 1;
    try { localStorage.setItem(LS_AUTO_GIFT_DAY, JSON.stringify(d)); } catch (e) {}
  }

  function maybeAutoGift() {
    var hour = new Date().getHours();
    if (hour >= 0 && hour < 6) return;

    var day = getAutoGiftDay();
    if (day.count >= (settings.dailyLimit || 3)) return;

    if (Math.random() > (settings.autoGiftProbability || 0.3)) return;

    if (wallet.systemBalance <= 0) return;

    var roll = Math.random();
    var gift = null;
    var fromMyWish = false;
    var side = 'in';
    var specialText = '';

    if (roll < BRANCH_BUY_MY_WISH && myWishes.length > 0) {
      var myWish = randomPick(myWishes);
      gift = DEFAULT_GIFTS.find(function (g) { return g.id === myWish.giftId; });
      if (!gift) {
        gift = { id: myWish.giftId, name: myWish.name, price: myWish.price, emoji: myWish.emoji };
      }
      fromMyWish = true;
    } else if (roll < BRANCH_BUY_MY_WISH + BRANCH_BUY_SELF) {
      gift = randomPick(DEFAULT_GIFTS);
      side = 'self';
    } else {
      gift = randomPick(DEFAULT_GIFTS);
      side = 'in';
    }

    if (!gift) return;
    if (gift.price > wallet.systemBalance) {
      var affordable = DEFAULT_GIFTS.filter(function (g) { return g.price <= wallet.systemBalance; });
      if (affordable.length === 0) return;
      gift = randomPick(affordable);
    }

    wallet.systemBalance -= gift.price;
    saveWallet();

    var record = {
      id: genId('box'),
      giftId: gift.id,
      name: gift.name,
      price: gift.price,
      emoji: gift.emoji,
      wish: fromMyWish ? '实现了你的心愿' : (side === 'self' ? 'Ta 给自己买的' : 'Ta 随机挑的'),
      side: side,
      claimed: false,
      tm: Date.now()
    };
    boxItems.push(record);

    if (fromMyWish) {
      specialText = '我的心愿被你实现啦！';
    }

       // ★ 关键：先同步渲染聊天礼物卡（不依赖 Promise）
    try {
      if (typeof window.chatAddGift === 'function') {
        window.chatAddGift(record);
      } else {
        console.warn('[market] chatAddGift 未定义，跳过聊天渲染');
      }
    } catch (e) {
      console.warn('[market] chatAddGift 调用失败', e);
    }

    // 再保存 + 刷新 UI
    saveBox();
    saveWallet();
    renderBox();
    updateWalletUI();
    bumpAutoGiftDay();

    // TA 回复
    scheduleTaReplyToGift(side, specialText || null);

    // ★ 根据分支弹不同文案
    if (side === 'self') {
      showGiftToast('Ta 给自己买了一件心意');
    } else {
      showGiftToast('收到了一份来自 Ta 的心意');
    }
    showGiftUnreadDot();
    });
  }

  function scheduleAutoGift() {
    if (autoGiftScheduled) return;
    autoGiftScheduled = true;

    function tick() {
      resolveCurrentContact();
      maybeAutoGift();
      var next = randomInt(AUTO_GIFT_MIN, AUTO_GIFT_MAX);
      autoGiftTimer = setTimeout(tick, next);
    }

    var first = randomInt(AUTO_GIFT_MIN, AUTO_GIFT_MAX);
    autoGiftTimer = setTimeout(tick, first);
  }

  // ==================== 设置弹窗 ====================
  function openSettingsModal() {
    var old = document.getElementById('mktSettingsModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var modal = document.createElement('div');
    modal.id = 'mktSettingsModal';
    modal.className = 'mkt-modal';
    modal.innerHTML =
      '<div class="mkt-panel">' +
        '<div class="mkt-panel-title">市集设置</div>' +
        '<div class="mkt-setting-row">' +
          '<label class="mkt-setting-label">自动送礼概率（0~1）</label>' +
          '<input type="number" step="0.05" min="0" max="1" class="mkt-panel-input" id="mktSettingProb" value="' +
            settings.autoGiftProbability + '">' +
        '</div>' +
        '<div class="mkt-setting-row">' +
          '<label class="mkt-setting-label">每日上限</label>' +
          '<input type="number" min="1" max="20" class="mkt-panel-input" id="mktSettingLimit" value="' +
            settings.dailyLimit + '">' +
        '</div>' +
        '<div class="mkt-setting-row">' +
          '<label class="mkt-setting-label">回复概率（0~1）</label>' +
          '<input type="number" step="0.05" min="0" max="1" class="mkt-panel-input" id="mktSettingReply" value="' +
            settings.replyProbability + '">' +
        '</div>' +
        '<div class="mkt-panel-actions">' +
          '<button class="mkt-btn mkt-btn-cancel" id="mktSettingCancel">取消</button>' +
          '<button class="mkt-btn mkt-btn-confirm" id="mktSettingSave">保存</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    function closeModal() {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }

    document.getElementById('mktSettingCancel').addEventListener('click', closeModal);
    document.getElementById('mktSettingSave').addEventListener('click', function () {
      var p = parseFloat(document.getElementById('mktSettingProb').value);
      var l = parseInt(document.getElementById('mktSettingLimit').value, 10);
      var r = parseFloat(document.getElementById('mktSettingReply').value);
      if (isNaN(p) || p < 0 || p > 1) { alert('自动送礼概率 0~1'); return; }
      if (isNaN(l) || l < 1) { alert('每日上限 ≥1'); return; }
      if (isNaN(r) || r < 0 || r > 1) { alert('回复概率 0~1'); return; }
      settings.autoGiftProbability = p;
      settings.dailyLimit = l;
      settings.replyProbability = r;
      saveSettings().then(closeModal);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  // ==================== Tab 切换 ====================
  mktTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      mktTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      Object.keys(mktViews).forEach(function (k) {
        if (mktViews[k]) mktViews[k].classList.toggle('active', k === name);
      });
      if (name === 'cabinet') renderBox();
      if (name === 'wishlist') renderWishes();
    });
  });

  document.querySelectorAll('#mktViewCabinet .mkt-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mktViewCabinet .mkt-sub-tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      currentSubTab = btn.getAttribute('data-sub');
      renderBox();
    });
  });

  document.querySelectorAll('#mktViewWishlist .mkt-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mktViewWishlist .mkt-sub-tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      currentWishTab = btn.getAttribute('data-sub');
      renderWishes();
    });
  });

  // ==================== 页面进入 ====================
  function enterMarket() {
    resolveCurrentContact();
    Promise.all([loadWallet(), loadBox(), loadWishes(), loadSettings()]).then(function () {
      renderCategories();
      renderGoods();
      renderBox();
      renderWishes();
      clearGiftUnreadDot();     // ★ 进入市集清除"未读礼物"红点
    });
  }

  if (btnMarket) {
    btnMarket.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.showPage && window.pageMarket) {
        window.showPage(window.pageMarket);
      } else if (window.showPage) {
        var p = document.getElementById('pageMarket');
        if (p) window.showPage(p);
      }
      enterMarket();
    });
  }

  if (mktBackBtn) {
    mktBackBtn.addEventListener('click', function () {
      if (window.showPage && window.pageHome) {
        window.showPage(window.pageHome);
      }
    });
  }

  if (mktWalletBtn) {
    mktWalletBtn.addEventListener('click', openWalletModal);
  }

  var mktSettingsBtn = document.getElementById('mktSettingsBtn');
  if (mktSettingsBtn) {
    mktSettingsBtn.addEventListener('click', openSettingsModal);
  }

  // ==================== 初始化 ====================
  function init() {
    resolveCurrentContact();
    Promise.all([loadWallet(), loadBox(), loadWishes(), loadSettings()]).then(function () {
      renderCategories();
      renderGoods();
      renderBox();
      renderWishes();
      applyGiftUnreadDot();     // ★ 初始化时应用红点状态
      scheduleAutoGift();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==================== 暴露接口 ====================
  window.market = {
    enter: enterMarket,
    CATEGORIES: CATEGORIES,
    GIFTS: DEFAULT_GIFTS,
    getWallet: function () { return wallet; },
    setWallet: function (myBalance, systemBalance) {
      if (typeof myBalance === 'number') wallet.myBalance = myBalance;
      if (typeof systemBalance === 'number') wallet.systemBalance = systemBalance;
      return saveWallet().then(updateWalletUI);
    },
    formatPrice: formatPrice,
    getBoxItems: function () { return boxItems; },
    getWishes: function () { return { my: myWishes, ta: taWishes }; },

    claimGift: function (giftRecordId) {
      var it = boxItems.find(function (x) { return x.id === giftRecordId; });
      if (!it) return;
      if (it.claimed) return;
      it.claimed = true;
      saveBox().then(function () {
        renderBox();
        if (typeof window.chatMarkGiftClaimed === 'function') {
          try { window.chatMarkGiftClaimed(giftRecordId); } catch (e) {}
        }
      });
    },

    simulateIncoming: function (giftId, wish) {
      var gift = DEFAULT_GIFTS.find(function (g) { return g.id === giftId; }) || DEFAULT_GIFTS[0];
      var rec = {
        id: genId('box'),
        giftId: gift.id,
        name: gift.name,
        price: gift.price,
        emoji: gift.emoji,
        wish: wish || '来自 Ta 的心意',
        side: 'in',
        claimed: false,
        tm: Date.now()
      };
      boxItems.push(rec);
      saveBox().then(function () {
        renderBox();
        if (typeof window.chatAddGift === 'function') {
          try { window.chatAddGift(rec); } catch (e) {}
        }
        showGiftToast('收到了一份来自 Ta 的心意');
        showGiftUnreadDot();
      });
    },

    forceAutoGift: function () {
      var savedProb = settings.autoGiftProbability;
      var savedDay = getAutoGiftDay();
      settings.autoGiftProbability = 1;
      try { localStorage.setItem(LS_AUTO_GIFT_DAY, JSON.stringify({ date: savedDay.date, count: 0 })); } catch (e) {}
      maybeAutoGift();
      settings.autoGiftProbability = savedProb;
    },

    getSettings: function () { return settings; },
    setSettings: function (patch) {
      settings = Object.assign({}, settings, patch || {});
      return saveSettings();
    },
    openSettingsModal: openSettingsModal,

    addMyWish: function (giftId) {
      var gift = DEFAULT_GIFTS.find(function (g) { return g.id === giftId; });
      if (gift) addWishFromGift(gift);
    },

    // 测试：手动弹出礼物浮层
    showGiftToast: showGiftToast,
    clearGiftUnreadDot: clearGiftUnreadDot
  };

})();
