/**
 * 传讯页面专属逻辑
 * 导出全局函数 initMessageApp() 供 main.js 调用
 *
 * 功能：
 *  - 打开/关闭聊天界面（带滑入动画）
 *  - 发送消息（生成气泡、清空输入框）
 *  - 模拟接收回复
 */

function initMessageApp() {
  'use strict';

  // ==================== DOM 元素 ====================
  const messageApp = document.getElementById('messageApp');
  const messageBackBtn = document.getElementById('messageBackBtn');
  const messageBody = document.getElementById('messageBody');
  const messageInput = document.getElementById('messageInput');
  const messageSendBtn = document.getElementById('messageSendBtn');
  const tabMessage = document.getElementById('tabMessage');

  if (!messageApp || !messageBody || !messageInput || !messageSendBtn) {
    console.warn('[message.js] 传讯页面元素缺失，无法初始化。');
    return;
  }

  // ==================== 打开/关闭逻辑 ====================
  function openMessageApp() {
    messageApp.classList.add('active');
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
    // 打开后滚动到底部
    setTimeout(scrollToBottom, 320);
  }

  function closeMessageApp() {
    messageApp.classList.remove('active');
    document.body.style.overflow = '';
  }

  // 点击底部 Tab 的“传讯”按钮打开
  if (tabMessage) {
    tabMessage.addEventListener('click', function (e) {
      e.preventDefault();
      openMessageApp();
    });
  }

  // 点击左上角返回按钮关闭
  if (messageBackBtn) {
    messageBackBtn.addEventListener('click', closeMessageApp);
  }

  // ==================== 发送消息 ====================
  function updateSendBtnState() {
    const hasText = messageInput.value.trim().length > 0;
    messageSendBtn.disabled = !hasText;
  }
  messageInput.addEventListener('input', updateSendBtnState);

  function scrollToBottom() {
    requestAnimationFrame(function () {
      messageBody.scrollTop = messageBody.scrollHeight;
    });
  }

  function appendMessage(text, isSelf) {
    const row = document.createElement('div');
    row.className = 'message-row ' + (isSelf ? 'self' : 'other');
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    messageBody.appendChild(row);
    scrollToBottom();
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    // 1. 添加自己的消息
    appendMessage(text, true);

    // 2. 清空输入框
    messageInput.value = '';
    updateSendBtnState();

    // 3. 模拟 1 秒后自动回复
    setTimeout(function () {
      appendMessage('收到你的消息啦~', false);
    }, 1000);
  }

  messageSendBtn.addEventListener('click', sendMessage);

  // 回车发送
  messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ==================== 初始化状态 ====================
  updateSendBtnState();
  scrollToBottom();
}
