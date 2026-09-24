const TRYON_URL = 'https://fashion-virtual-try-on-two.vercel.app/';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fashion-vton-tryon-image',
    title: 'Try On this image',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== 'fashion-vton-tryon-image' || !info.srcUrl) return;
  openTryOn(info.srcUrl);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'FASHION_VTON_TRY_ON' && message.imageUrl) {
    openTryOn(message.imageUrl);
  }
});

function openTryOn(imageUrl) {
  const target = `${TRYON_URL}?garment=${encodeURIComponent(imageUrl)}&source=extension`;
  chrome.tabs.create({ url: target });
}
