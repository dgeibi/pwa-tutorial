if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}

const divInstall = document.getElementById('installContainer');
const butInstall = document.getElementById('butInstall');

window.addEventListener('beforeinstallprompt', event => {
  window.deferredPrompt = event; // 保存event，以备用户点击按钮时使用，不能直接使用
  event.userChoice.then(result => {
    // 用户选择安装与否
    // {outcome: "accepted", platform: "web"} or {outcome: "dismissed", platform: ""}
    console.log(result);
    divInstall.classList.toggle('hidden', true); // 隐藏安装按钮
    window.deferredPrompt = null; // 用户选择后 event 已经失效
  });
  // 显示安装按钮
  divInstall.classList.toggle('hidden', false);
});

butInstall.addEventListener('click', () => {
  const promptEvent = window.deferredPrompt;
  if (!promptEvent) {
    return;
  }

  // 弹出安装弹窗
  promptEvent.prompt();
});

window.addEventListener('appinstalled', event => {
  // PWA 安装成功
});
