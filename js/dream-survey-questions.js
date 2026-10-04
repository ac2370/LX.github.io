/**
 * 梦向问卷 · 问卷库（内置示例题）
 * 4 个分类，每类 4 道，共 16 道
 * 后续加题只需往 LIB 里 push
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
    {
      key: 'daily',
      label: '日常询问',
      icon: 'fa-solid fa-mug-hot',
      questions: [
        { type: 'text', text: '今天心情怎么样？' },
        { type: 'single', text: '今天吃了什么好吃的东西？', options: ['热乎乎的汤面', '甜甜的蛋糕', '家常小菜', '还没想好'] },
        { type: 'text', text: '今天什么时候最开心？' },
        { type: 'single', text: '今天想和我一起做什么？', options: ['窝着看剧', '出去散步', '什么都不做', '听我讲讲今天'] }
      ]
    },
    {
      key: 'care',
      label: '关心询问',
      icon: 'fa-solid fa-hand-holding-heart',
      questions: [
        { type: 'text', text: '最近有没有哪里不舒服？' },
        { type: 'single', text: '这段时间最需要什么？', options: ['多休息', '找人陪', '安静一下', '被夸夸'] },
        { type: 'text', text: '有什么想对我说的、一直没说的？' },
        { type: 'multi', text: '今天想被怎么安慰？', options: ['抱抱', '夸夸', '听我说', '一起发呆', '讲个笑话'], multiMax: 2 }
      ]
    },
    {
      key: 'interact',
      label: '互动询问',
      icon: 'fa-solid fa-comments',
      questions: [
        { type: 'single', text: '如果我是动物，你觉得我是什么？', options: ['猫', '狗', '兔子', '狐狸'] },
        { type: 'text', text: '如果只能和我说一句话，你会说什么？' },
        { type: 'multi', text: '想和我做哪些事？', options: ['看海', '爬山', '一起做一顿饭', '逛市集', '拍很多照片'], multiMax: 3 },
        { type: 'text', text: '如果要给我起一个绰号，会是什么？' }
      ]
    },
    {
      key: 'world',
      label: '两个世界',
      icon: 'fa-solid fa-globe',
      questions: [
        { type: 'text', text: '在你那边，现在是什么天气？' },
        { type: 'single', text: '你那边现在是什么季节？', options: ['春天', '夏天', '秋天', '冬天'] },
        { type: 'text', text: '你那边今天发生了什么有趣的事？' },
        { type: 'text', text: '你那边的人也会像我们这样聊天吗？' }
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
