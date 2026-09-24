(() => {
  const BUTTON_CLASS = 'fashion-vton-button';
  const MIN_SIZE = 120;
  const TRYON_HOSTS = new Set([
    'fashion-try-on.vercel.app',
    'fashion-try-on.netlify.app',
    'fashion-virtual-try-on-two.vercel.app'
  ]);

  if (TRYON_HOSTS.has(location.hostname) || location.hostname.endsWith('.fashion-try-on.vercel.app')) return;

  const css = document.createElement('style');
  css.textContent = `
    .${BUTTON_CLASS}{
      position:fixed;z-index:2147483647;display:none;align-items:center;justify-content:center;
      padding:9px 13px;border-radius:999px;border:1px solid rgba(246,247,248,.24);
      background:rgba(11,13,16,.95);color:#f6f7f8;
      font:700 12px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      box-shadow:0 8px 24px rgba(0,0,0,.28);cursor:pointer;letter-spacing:.05em;
      user-select:none;white-space:nowrap;
    }
    .${BUTTON_CLASS}.is-visible{display:flex}
    .${BUTTON_CLASS}:hover{background:rgba(182,255,99,.98);color:#12160f}
  `;
  document.documentElement.appendChild(css);

  let currentImage = null;
  let currentButton = null;
  let hideTimer = null;

  function eligible(img) {
    if (!(img instanceof HTMLImageElement)) return false;
    if (!img.isConnected || !img.currentSrc && !img.src) return false;
    const rect = img.getBoundingClientRect();
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return false;
    const style = getComputedStyle(img);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    return true;
  }

  function positionButton(img, button) {
    if (!eligible(img)) {
      button.classList.remove('is-visible');
      return false;
    }
    const rect = img.getBoundingClientRect();
    const buttonWidth = 96;
    button.style.top = `${Math.max(8, rect.top + 10)}px`;
    button.style.left = `${Math.min(window.innerWidth - buttonWidth - 8, Math.max(8, rect.right - buttonWidth - 10))}px`;
    return true;
  }

  function show(img, button) {
    clearTimeout(hideTimer);
    currentImage = img;
    currentButton = button;
    if (positionButton(img, button)) button.classList.add('is-visible');
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (currentButton) currentButton.classList.remove('is-visible');
    }, 180);
  }

  function attach(img) {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fashionVtonBound === '1') return;
    img.dataset.fashionVtonBound = '1';

    const button = document.createElement('button');
    button.className = BUTTON_CLASS;
    button.type = 'button';
    button.textContent = 'TRY ON';
    button.setAttribute('aria-label', 'Try this image on');

    img.addEventListener('pointerenter', () => show(img, button), { passive: true });
    img.addEventListener('pointerleave', scheduleHide, { passive: true });
    button.addEventListener('pointerenter', () => show(img, button), { passive: true });
    button.addEventListener('pointerleave', scheduleHide, { passive: true });
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const imageUrl = img.currentSrc || img.src;
      if (!imageUrl) return;
      chrome.runtime.sendMessage({ type: 'FASHION_VTON_TRY_ON', imageUrl });
    });

    document.body.appendChild(button);
    if (img.complete) positionButton(img, button);
    img.addEventListener('load', () => positionButton(img, button), { once: true });
  }

  function scan() {
    if (TRYON_HOSTS.has(location.hostname) || location.hostname.endsWith('.fashion-try-on.vercel.app')) return;
    document.querySelectorAll('img').forEach(attach);
  }

  window.addEventListener('scroll', () => {
    if (currentImage && currentButton?.classList.contains('is-visible')) positionButton(currentImage, currentButton);
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (currentImage && currentButton?.classList.contains('is-visible')) positionButton(currentImage, currentButton);
  });

  scan();
  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { subtree: true, childList: true });
})();
