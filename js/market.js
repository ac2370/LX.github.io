/* ============================================================
   market.js —— 心意市集（钱包 + 商品库 + 分类/商品渲染）
   数据：
     - localforage 键 'giftWallet'
       { myBalance: 52000, systemBalance: 52000 }   // 单位：分
   内置：
     - CATEGORIES: 10 个分类
     - DEFAULT_GIFTS: 60+ 商品
   依赖：
     - window.showPage / window.pageMarket / window.pageHome
   ============================================================ */
(function () {
  'use strict';

  console.log('market loaded');

  // ==================== 常量 ====================
  var STORE_KEY_WALLET = 'giftWallet';

  // 默认钱包（单位：分）
  var DEFAULT_WALLET = {
    myBalance: 52000,       // ¥520
    systemBalance: 52000    // ¥520
  };

  // 分类
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

  // 商品库（价格单位：分。¥10 = 1000，¥520 = 52000）
  var DEFAULT_GIFTS = [
    // ===== 花束 =====
    { id: 'flower_1', name: '一朵小花',       price: 1000,  emoji: '🌷', category: 'flower' },
    { id: 'flower_2', name: '满天星',         price: 3000,  emoji: '💐', category: 'flower' },
    { id: 'flower_3', name: '红玫瑰花束',     price: 8000,  emoji: '🌹', category: 'flower' },
    { id: 'flower_4', name: '郁金香',         price: 12000, emoji: '🌷', category: 'flower' },
    { id: 'flower_5', name: '向日葵',         price: 15000, emoji: '🌻', category: 'flower' },
    { id: 'flower_6', name: '蓝色妖姬',       price: 26000, emoji: '💙', category: 'flower' },
    { id: 'flower_7', name: '蓝色绣球',       price: 32000, emoji: '🌺', category: 'flower' },
    { id: 'flower_8', name: '白色铃兰',       price: 52000, emoji: '🌼', category: 'flower' },

    // ===== 甜品 =====
    { id: 'dessert_1', name: '布丁',           price: 1000,  emoji: '🍮', category: 'dessert' },
    { id: 'dessert_2', name: '马卡龙',         price: 3000,  emoji: '🍬', category: 'dessert' },
    { id: 'dessert_3', name: '甜甜圈',         price: 5000,  emoji: '🍩', category: 'dessert' },
    { id: 'dessert_4', name: '草莓蛋糕',       price: 12000, emoji: '🍰', category: 'dessert' },
    { id: 'dessert_5', name: '芝士蛋糕',       price: 16000, emoji: '🎂', category: 'dessert' },
    { id: 'dessert_6', name: '手工巧克力',     price: 22000, emoji: '🍫', category: 'dessert' },
    { id: 'dessert_7', name: '定制生日蛋糕',   price: 48000, emoji: '🎂', category: 'dessert' },

    // ===== 饮品 =====
    { id: 'drink_1', name: '柠檬水',           price: 1000,  emoji: '🍋', category: 'drink' },
    { id: 'drink_2', name: '美式咖啡',         price: 3000,  emoji: '☕', category: 'drink' },
    { id: 'drink_3', name: '珍珠奶茶',         price: 4000,  emoji: '🧋', category: 'drink' },
    { id: 'drink_4', name: '抹茶拿铁',         price: 6000,  emoji: '🍵', category: 'drink' },
    { id: 'drink_5', name: '鲜榨橙汁',         price: 8000,  emoji: '🍊', category: 'drink' },
    { id: 'drink_6', name: '香槟',             price: 32000, emoji: '🍾', category: 'drink' },
    { id: 'drink_7', name: '精酿红酒',         price: 52000, emoji: '🍷', category: 'drink' },

    // ===== 饰品 =====
    { id: 'jewelry_1', name: '发绳',           price: 1000,  emoji: '🎀', category: 'jewelry' },
    { id: 'jewelry_2', name: '耳钉',           price: 5000,  emoji: '💠', category: 'jewelry' },
    { id: 'jewelry_3', name: '手链',           price: 12000, emoji: '📿', category: 'jewelry' },
    { id: 'jewelry_4', name: '银戒指',         price: 26000, emoji: '💍', category: 'jewelry' },
    { id: 'jewelry_5', name: '锁骨链',         price: 32000, emoji: '⛓️', category: 'jewelry' },
    { id: 'jewelry_6', name: '珍珠耳环',       price: 42000, emoji: '💎', category: 'jewelry' },
    { id: 'jewelry_7', name: '钻戒',           price: 52000, emoji: '💍', category: 'jewelry' },

    // ===== 星空 =====
    { id: 'star_1', name: '一颗流星',         price: 5000,  emoji: '🌠', category: 'star' },
    { id: 'star_2', name: '许愿星',           price: 8000,  emoji: '⭐', category: 'star' },
    { id: 'star_3', name: '一轮月亮',         price: 15000, emoji: '🌙', category: 'star' },
    { id: 'star_4', name: '满天繁星',         price: 28000, emoji: '✨', category: 'star' },
    { id: 'star_5', name: '整片银河',         price: 45000, emoji: '🌌', category: 'star' },
    { id: 'star_6', name: '属于你的星座',     price: 52000, emoji: '🌟', category: 'star' },

    // ===== 出行 =====
    { id: 'travel_1', name: '一次散步',       price: 1000,  emoji: '🚶', category: 'travel' },
    { id: 'travel_2', name: '一场电影',       price: 8000,  emoji: '🎬', category: 'travel' },
    { id: 'travel_3', name: '周末一日游',     price: 18000, emoji: '🚗', category: 'travel' },
    { id: 'travel_4', name: '火车票',         price: 22000, emoji: '🚆', category: 'travel' },
    { id: 'travel_5', name: '机票',           price: 48000, emoji: '✈️', category: 'travel' },
    { id: 'travel_6', name: '海岛度假',       price: 52000, emoji: '🏝️', category: 'travel' },

    // ===== 娱乐 =====
    { id: 'fun_1', name: '一句晚安',         price: 1000,  emoji: '🌙', category: 'fun' },
    { id: 'fun_2', name: '一起打游戏',       price: 6000,  emoji: '🎮', category: 'fun' },
    { id: 'fun_3', name: '演唱会门票',       price: 26000, emoji: '🎤', category: 'fun' },
    { id: 'fun_4', name: '游乐园一日游',     price: 32000, emoji: '🎡', category: 'fun' },
    { id: 'fun_5', name: '定制歌曲',         price: 42000, emoji: '🎵', category: 'fun' },
    { id: 'fun_6', name: '一张 VIP 门票',    price: 52000, emoji: '🎫', category: 'fun' },

    // ===== 关怀 =====
    { id: 'care_1', name: '一个拥抱',         price: 1000,  emoji: '🤗', category: 'care' },
    { id: 'care_2', name: '一句关心',         price: 2000,  emoji: '💌', category: 'care' },
    { id: 'care_3', name: '热水袋',           price: 6000,  emoji: '🌡️', category: 'care' },
    { id: 'care_4', name: '毛绒玩偶',         price: 12000, emoji: '🧸', category: 'care' },
    { id: 'care_5', name: '按摩一次',         price: 22000, emoji: '💆', category: 'care' },
    { id: 'care_6', name: '陪伴一整天',       price: 52000, emoji: '💝', category: 'care' },

    // ===== 日常 =====
    { id: 'daily_1', name: '一支牙膏',         price: 1000,  emoji: '🪥', category: 'daily' },
    { id: 'daily_2', name: '一支洗面奶',       price: 4000,  emoji: '🧴', category: 'daily' },
    { id: 'daily_3', name: '一包纸巾',         price: 5000,  emoji: '🧻', category: 'daily' },
    { id: 'daily_4', name: '一把雨伞',         price: 8000,  emoji: '☂️', category: 'daily' },
    { id: 'daily_5', name: '一个保温杯',       price: 12000, emoji: '🥤', category: 'daily' },
    { id: 'daily_6', name: '一份下午茶',       price: 18000, emoji: '🍱', category: 'daily' },
    { id: 'daily_7', name: '一周外卖卡',       price: 26000, emoji: '🍜', category: 'daily' },

    // ===== 药品 =====
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

  // ==================== 状态 ====================
  var wallet = Object.assign({}, DEFAULT_WALLET);
  var walletReady = false;

  var currentCategory = CATEGORIES[0].key;

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // 分 → ¥xxx.xx
  function formatPrice(cents) {
    var n = Number(cents) || 0;
    var yuan = n / 100;
    if (yuan === Math.floor(yuan)) {
      return '¥' + yuan;
    }
    return '¥' + yuan.toFixed(2);
  }

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

  // ==================== 钱包修改弹窗 ====================
  function openWalletModal() {
    var old = document.getElementById('mktWalletModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var modal = document.createElement('div');
    modal.id = 'mktWalletModal';
    modal.className = 'mkt-modal';
    modal.innerHTML =
      '<div class="mkt-panel">' +
        '<div class="mkt-panel-title">修改心意币余额</div>' +
        '<input type="number" class="mkt-panel-input" id="mktWalletInput" placeholder="输入余额（¥）" value="' +
          (wallet.myBalance / 100) + '">' +
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
      var input = document.getElementById('mktWalletInput');
      var val = parseFloat(input.value);
      if (isNaN(val) || val < 0) {
        alert('请输入有效的金额');
        return;
      }
      wallet.myBalance = Math.round(val * 100);
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
    var goods = DEFAULT_GIFTS.filter(function (g) {
      return g.category === currentCategory;
    });

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

  // ==================== 购买弹窗（占位） ====================
  function openBuyModal(giftId) {
    var gift = DEFAULT_GIFTS.find(function (g) { return g.id === giftId; });
    if (!gift) return;
    alert(
      '即将购买：\n\n' +
      gift.emoji + ' ' + gift.name + '\n' +
      '价格：' + formatPrice(gift.price) + '\n\n' +
      '（购买功能下一步实现）'
    );
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
    });
  });

  // 心意柜子 tab（仅切 UI）
  document.querySelectorAll('#mktViewCabinet .mkt-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mktViewCabinet .mkt-sub-tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  // 心愿单子 tab（仅切 UI）
  document.querySelectorAll('#mktViewWishlist .mkt-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mktViewWishlist .mkt-sub-tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  // ==================== 页面进入 ====================
  function enterMarket() {
    if (!walletReady) {
      loadWallet().then(function () {
        renderCategories();
        renderGoods();
      });
    } else {
      updateWalletUI();
      renderCategories();
      renderGoods();
    }
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

  // ==================== 初始化 ====================
  function init() {
    loadWallet().then(function () {
      renderCategories();
      renderGoods();
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
    formatPrice: formatPrice
  };

})();
