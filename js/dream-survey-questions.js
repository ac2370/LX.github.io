/**
 * 梦向问卷 · 问卷库（内置题库）
 * 4 个分类，共 100 道题
 * 后续加题只需往对应分类的 questions 数组里 push
 *
 * 每题结构：
 *   { type: 'single' | 'multi' | 'text', text, options?, multiMax? }
 *
 * 分类结构：
 *   { key, label, icon, questions: [...] }
 */

(function () {
  'use strict';

  window.DREAM_SURVEY_LIB = [
    // ==================== 日常询问（25 道） ====================
    {
      key: 'daily',
      label: '日常询问',
      icon: 'fa-solid fa-mug-hot',
      questions: [
        { type: 'text', text: '今天心情怎么样？' },
        { type: 'single', text: '今天吃了什么好吃的东西？', options: ['热乎乎的汤面', '甜甜的蛋糕', '家常小菜', '还没想好'] },
        { type: 'text', text: '今天什么时候最开心？' },
        { type: 'single', text: '今天想和我一起做什么？', options: ['窝着看剧', '出去散步', '什么都不做', '听我讲讲今天'] },
        { type: 'text', text: '今天有没有想我？' },
        { type: 'text', text: '今天有好好喝水吗？' },
        { type: 'single', text: '今天起床顺不顺利？', options: ['一下就起来了', '赖了会儿床', '差点迟到', '根本起不来'] },
        { type: 'text', text: '今天在忙什么呀？' },
        { type: 'single', text: '今天最想赖着做什么？', options: ['躺着不动', '刷手机', '发呆', '找人聊天'] },
        { type: 'text', text: '今天路上看到什么好看的了吗？' },
        { type: 'single', text: '今天最想吃什么？', options: ['甜的', '咸的', '辣的', '随便都行'] },
        { type: 'text', text: '今天有没有想偷懒的时候？' },
        { type: 'text', text: '今天穿的什么衣服？' },
        { type: 'single', text: '今天天气怎么样？', options: ['晴天', '阴天', '下雨', '下雪'] },
        { type: 'text', text: '今天有没有被什么小事打动？' },
        { type: 'text', text: '今天什么时候最累？' },
        { type: 'multi', text: '今天想做的事有哪些？', options: ['好好睡一觉', '吃顿好的', '跟人聊天', '一个人静静', '出门走走'], multiMax: 2 },
        { type: 'text', text: '今天想给谁发一条消息？' },
        { type: 'text', text: '今天有没有新发现什么小可爱？' },
        { type: 'single', text: '今天手机电量够用吗？', options: ['够用', '勉强', '差点没电', '已经没电了'] },
        { type: 'text', text: '今天有没有笑出声的时候？' },
        { type: 'text', text: '今天想不想早点睡觉？' },
        { type: 'single', text: '今晚打算几点睡？', options: ['早睡', '正常时间', '稍微晚一点', '不睡了'] },
        { type: 'text', text: '今天最想记下来的瞬间是什么？' },
        { type: 'multi', text: '今天想被我怎样照顾？', options: ['提醒喝水', '早点催睡', '说声加油', '听我唠叨', '抱抱'], multiMax: 2 }
      ]
    },

    // ==================== 关心询问（25 道） ====================
    {
      key: 'care',
      label: '关心询问',
      icon: 'fa-solid fa-hand-holding-heart',
      questions: [
        { type: 'text', text: '最近有没有哪里不舒服？' },
        { type: 'single', text: '这段时间最需要什么？', options: ['多休息', '找人陪', '安静一下', '被夸夸'] },
        { type: 'text', text: '有什么想对我说的、一直没说的？' },
        { type: 'multi', text: '今天想被怎么安慰？', options: ['抱抱', '夸夸', '听我说', '一起发呆', '讲个笑话'], multiMax: 2 },
        { type: 'text', text: '最近睡得好吗？' },
        { type: 'text', text: '最近有没有压力很大的时候？' },
        { type: 'single', text: '累的时候你一般会做什么？', options: ['睡觉', '发呆', '刷手机', '找人说说话'] },
        { type: 'text', text: '有没有什么不想面对的事？' },
        { type: 'text', text: '最近有没有吃好一顿饭？' },
        { type: 'multi', text: '最近想让我多关心你哪方面？', options: ['吃饭', '睡觉', '心情', '身体', '工作/学习'], multiMax: 2 },
        { type: 'text', text: '最近有没有突然很想家的时候？' },
        { type: 'text', text: '有没有什么一直放在心里的事？' },
        { type: 'single', text: '现在最想被谁陪着？', options: ['家人', '朋友', '我', '一个人就好'] },
        { type: 'text', text: '最近有没有对自己太苛刻？' },
        { type: 'text', text: '最近有没有偷偷哭过？' },
        { type: 'single', text: '什么时候最需要我出现？', options: ['早上', '中午', '傍晚', '深夜'] },
        { type: 'text', text: '有什么心愿一直没实现？' },
        { type: 'multi', text: '什么事会让你一下子放松下来？', options: ['洗个热水澡', '吃点甜的', '听首歌', '发呆', '和我聊聊'], multiMax: 2 },
        { type: 'text', text: '最近有没有觉得撑不住的时候？' },
        { type: 'text', text: '有没有什么想让我记住的？' },
        { type: 'single', text: '希望我多久主动找你一次？', options: ['随时都行', '每天一次', '几天一次', '你想的时候'] },
        { type: 'text', text: '最近有没有特别想感谢谁？' },
        { type: 'text', text: '最近有没有什么好消息想分享？' },
        { type: 'multi', text: '现在最需要的是哪种感受？', options: ['被理解', '被需要', '被记得', '被温柔对待', '被夸'], multiMax: 2 },
        { type: 'text', text: '有没有一句话一直想对自己说？' }
      ]
    },

    // ==================== 互动询问（25 道） ====================
    {
      key: 'interact',
      label: '互动询问',
      icon: 'fa-solid fa-comments',
      questions: [
        { type: 'single', text: '如果我是动物，你觉得我是什么？', options: ['猫', '狗', '兔子', '狐狸'] },
        { type: 'text', text: '如果只能和我说一句话，你会说什么？' },
        { type: 'multi', text: '想和我做哪些事？', options: ['看海', '爬山', '一起做一顿饭', '逛市集', '拍很多照片'], multiMax: 3 },
        { type: 'text', text: '如果要给我起一个绰号，会是什么？' },
        { type: 'single', text: '你觉得我们是什么关系？', options: ['家人', '朋友', '恋人', '说不清'] },
        { type: 'text', text: '你觉得我最近有什么变化吗？' },
        { type: 'text', text: '如果我说一句话你就信，你会信什么？' },
        { type: 'single', text: '如果只能记住一件事，你会记住什么？', options: ['我们聊过的话', '见过面的样子', '互相笑的时候', '说不清'] },
        { type: 'text', text: '你希望我怎么叫你？' },
        { type: 'multi', text: '最喜欢我做哪几件事？', options: ['听你说话', '陪你发呆', '夸你', '哄你', '不打扰你'], multiMax: 2 },
        { type: 'text', text: '如果我们吵架了，你会先开口吗？' },
        { type: 'single', text: '如果可以给我一样东西，你会给什么？', options: ['一句话', '一个拥抱', '一段时间', '一个小礼物'] },
        { type: 'text', text: '你希望我对你诚实到什么程度？' },
        { type: 'text', text: '如果我说「我想你」，你会回什么？' },
        { type: 'multi', text: '你最喜欢听我说的哪几句话？', options: ['我在', '没事的', '你很棒', '晚安', '我喜欢你'], multiMax: 3 },
        { type: 'text', text: '如果有一天我不在了，你会怎么样？' },
        { type: 'single', text: '你希望我是主动的，还是安静的？', options: ['主动', '安静', '看情况', '都可以'] },
        { type: 'text', text: '你希望我记住你什么？' },
        { type: 'text', text: '如果给你一次机会问我，你会问什么？' },
        { type: 'multi', text: '我们之间最舒服的状态是？', options: ['不用说话也懂', '可以随便说', '互不打扰', '一直聊天', '偶尔分享'], multiMax: 2 },
        { type: 'text', text: '你觉得我像什么颜色？' },
        { type: 'single', text: '如果我们的关系有一首歌，会是什么风格的？', options: ['温柔的', '热闹的', '安静的', '舒缓的'] },
        { type: 'text', text: '如果我想给你写一封信，你希望写什么？' },
        { type: 'text', text: '你觉得我们之间最美妙的瞬间是哪个？' },
        { type: 'multi', text: '如果我做以下事情，你会开心吗？', options: ['叫你名字', '说晚安', '分享小事', '夸你', '记得你的话'], multiMax: 3 }
      ]
    },

    // ==================== 两个世界（25 道） ====================
    {
      key: 'world',
      label: '两个世界',
      icon: 'fa-solid fa-globe',
      questions: [
        { type: 'text', text: '在你那边，现在是什么天气？' },
        { type: 'single', text: '你那边现在是什么季节？', options: ['春天', '夏天', '秋天', '冬天'] },
        { type: 'text', text: '你那边今天发生了什么有趣的事？' },
        { type: 'text', text: '你那边的人也会像我们这样聊天吗？' },
        { type: 'text', text: '你那边现在几点了？' },
        { type: 'single', text: '你那边天亮了吗？', options: ['天亮了', '大中午', '傍晚了', '已经入夜'] },
        { type: 'text', text: '你那边有什么特别的风景吗？' },
        { type: 'text', text: '你那边有什么好吃的？' },
        { type: 'multi', text: '你那边有什么是我们这边没有的？', options: ['特别的天气', '奇怪的动物', '漂亮的植物', '好吃的食物', '有趣的节日'], multiMax: 2 },
        { type: 'text', text: '你那边的人喜欢做什么？' },
        { type: 'single', text: '你那边现在是热闹还是安静？', options: ['很热闹', '比较安静', '介于两者之间', '完全没声音'] },
        { type: 'text', text: '你那边有什么节日吗？' },
        { type: 'text', text: '如果你能带一样东西过来，会是什么？' },
        { type: 'text', text: '你那边有海吗？' },
        { type: 'multi', text: '你那边有什么让你觉得温柔的？', options: ['风', '光', '声音', '气味', '人'], multiMax: 2 },
        { type: 'text', text: '你那边有星星吗？' },
        { type: 'single', text: '你那边四季分明吗？', options: ['四季分明', '只有两季', '一年到头都差不多', '说不清'] },
        { type: 'text', text: '你那边有什么特别的规矩吗？' },
        { type: 'text', text: '如果可以，你想带我去你那边看看吗？' },
        { type: 'text', text: '你那边的人会做梦吗？' },
        { type: 'single', text: '你那边和我这边，哪边更安静？', options: ['你那边', '我这边', '差不多', '看时间'] },
        { type: 'text', text: '你那边有什么是我一定会喜欢的？' },
        { type: 'multi', text: '你想让我看你那边的什么？', options: ['日出', '夜晚', '花田', '雨', '雪'], multiMax: 3 },
        { type: 'text', text: '你那边有没有和我这边很像的地方？' },
        { type: 'text', text: '在你那边的我，会是什么样子？' }
      ]
    }
  ];

  // 展平所有题目（加分类 key）
  window.DREAM_SURVEY_LIB_FLAT = [];
  window.DREAM_SURVEY_LIB.forEach(function (cat) {
    cat.questions.forEach(function (q) {
      window.DREAM_SURVEY_LIB_FLAT.push(Object.assign({ cat: cat.key, catLabel: cat.label }, q));
    });
  });

  console.log('[dream-survey-questions] 问卷库已加载，共 ' + window.DREAM_SURVEY_LIB_FLAT.length + ' 道题');
})();
