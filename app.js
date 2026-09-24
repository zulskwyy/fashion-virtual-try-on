const VTON_BUILD = '10.9';
const els = {
  camera: document.getElementById('camera'),
  snapshot: document.getElementById('snapshot'),
  resultLayer: document.getElementById('resultLayer'),
  resultImage: document.getElementById('resultImage'),
  closeResult: document.getElementById('closeResult'),
  saveResult: document.getElementById('saveResult'),
  tryAnother: document.getElementById('tryAnother'),
  changeGarment: document.getElementById('changeGarment'),
  garmentFileLabel: document.getElementById('garmentFileLabel'),
  startCamera: document.getElementById('startCamera'),
  capture: document.getElementById('capture'),
  generate: document.getElementById('generate'),
  status: document.getElementById('status'),
  modePill: document.getElementById('modePill'),
  stageHint: document.getElementById('stageHint'),
  garmentPreview: document.getElementById('garmentPreview'),
  garmentEmpty: document.getElementById('garmentEmpty'),
  garmentFile: document.getElementById('garmentFile'),
  garmentType: document.getElementById('garmentType'),
  garmentDescription: document.getElementById('garmentDescription'),
  deviceHelp: document.getElementById('deviceHelp')
};

let stream = null;
let personDataUrl = null;
let garmentSource = null;
let source = 'direct';

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && window.matchMedia?.('(max-width: 900px)').matches);

function setStatus(text, mode = 'idle') {
  els.status.textContent = text;
  els.modePill.textContent = mode === 'busy' ? 'Generating' : mode === 'live' ? 'Camera live' : 'Ready';
}

function updateDeviceHelp() {
  if (!els.deviceHelp) return;
  if (source === 'extension') {
    els.deviceHelp.hidden = false;
    els.deviceHelp.textContent = 'Desktop: garment image imported automatically from the page. Start the camera, capture your frame, then generate.';
    return;
  }
  if (isMobile && !garmentSource) {
    els.deviceHelp.hidden = false;
    els.deviceHelp.textContent = 'HP: simpan gambar baju dari toko ke Galeri, lalu pilih “Upload another garment”. Kamera tetap menyala saat kamu mengganti baju.';
    return;
  }
  els.deviceHelp.hidden = true;
}

function readQueryGarment() {
  const url = new URL(location.href);
  const value = url.searchParams.get('garment');
  source = url.searchParams.get('source') || 'direct';
  if (!value) {
    updateDeviceHelp();
    return;
  }

  garmentSource = value;
  els.garmentPreview.src = value;
  els.garmentPreview.style.display = 'block';
  els.garmentEmpty.style.display = 'none';
  els.garmentDescription.value = inferDescription(value);
  els.garmentFileLabel.textContent = 'Change garment image';
  updateDeviceHelp();
}

function inferDescription(value) {
  try {
    const clean = decodeURIComponent(value).split('?')[0].split('#')[0];
    const name = clean.split('/').pop() || '';
    return name.replace(/[-_]+/g, ' ').replace(/\.(jpg|jpeg|png|webp|avif)$/i, '').slice(0, 80);
  } catch {
    return '';
  }
}

function canvasToCompressedDataUrl(sourceCanvas, maxSide = 900) {
  const scale = Math.min(1, maxSide / Math.max(sourceCanvas.width, sourceCanvas.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read garment image'));
    reader.readAsDataURL(file);
  });
}

function showCameraView() {
  els.resultLayer.hidden = true;
  els.stageHint.hidden = Boolean(stream);
}

function openGarmentPicker() {
  els.garmentFile?.click();
}

async function saveResultImage() {
  const src = els.resultImage.currentSrc || els.resultImage.src;
  if (!src) throw new Error('No generated image to save yet.');

  const filename = `fashion-try-on-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;

  try {
    const response = await fetch(src, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not read result image (${response.status}).`);

    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Fashion Virtual Try-On',
        text: 'Saved virtual try-on photo'
      });
      setStatus('Photo ready to save from the share sheet.', stream ? 'live' : 'idle');
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setStatus('Photo downloaded to your device.', stream ? 'live' : 'idle');
  } catch (error) {
    if (error?.name === 'AbortError') {
      setStatus('Save cancelled.', stream ? 'live' : 'idle');
      return;
    }
    const link = document.createElement('a');
    link.href = src;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
    setStatus('The result opened in a new tab. Use the browser save option to keep it on your device.', stream ? 'live' : 'idle');
  }
}

function captureFrame() {
  if (!els.camera.videoWidth || !els.camera.videoHeight) throw new Error('Camera frame is not ready yet.');
  const ctx = els.snapshot.getContext('2d', { alpha: false });
  els.snapshot.width = els.camera.videoWidth;
  els.snapshot.height = els.camera.videoHeight;
  ctx.drawImage(els.camera, 0, 0, els.snapshot.width, els.snapshot.height);
  personDataUrl = canvasToCompressedDataUrl(els.snapshot, 900);
  els.capture.disabled = false;
  els.generate.disabled = false;
  setStatus('Frame captured. You can generate, save the result, or change the garment without restarting the camera.', 'live');
}

async function startCamera() {
  try {
    if (!window.isSecureContext) throw new Error('Camera requires HTTPS. Open the deployed Vercel URL.');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not expose camera access.');

    setStatus('Starting camera…', 'live');
    els.capture.disabled = true;
    els.generate.disabled = !personDataUrl;

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    const attempts = [
      { audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: true }
    ];

    let lastError = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!stream) throw lastError || new Error('Camera could not be opened.');

    const video = els.camera;
    video.srcObject = stream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return resolve();
      const timeout = setTimeout(() => reject(new Error('Camera video did not become ready.')), 8000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
    });

    await video.play();
    if (!video.videoWidth || !video.videoHeight) throw new Error('Camera stream started but returned no video frame.');

    els.stageHint.hidden = true;
    els.capture.disabled = false;
    setStatus('Camera is live. Move naturally into frame, then capture a frame.', 'live');
  } catch (error) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    els.capture.disabled = true;
    setStatus(`Could not start camera: ${error?.message || 'Unknown camera error.'}`, 'idle');
  }
}

async function generateTryOn() {
  try {
    if (!personDataUrl) captureFrame();
    if (!garmentSource) throw new Error('No garment image selected. Pick an image first.');

    els.generate.disabled = true;
    setStatus('Sending person + garment to the VTON model…', 'busy');

    const response = await fetch('/api/tryon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personImage: personDataUrl,
        garmentImage: garmentSource,
        garmentDescription: els.garmentDescription.value.trim() || els.garmentType.options[els.garmentType.selectedIndex].text,
        garmentType: els.garmentType.value
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `VTON request failed (${response.status})`);
    if (!payload.resultUrl) throw new Error('VTON returned no result image.');

    els.resultImage.src = payload.resultUrl;
    els.resultLayer.hidden = false;
    setStatus('Try-on generated successfully.', 'ready');
  } catch (error) {
    setStatus(`Try-on failed: ${error.message}`, 'idle');
  } finally {
    els.generate.disabled = !personDataUrl;
  }
}

els.startCamera.addEventListener('click', startCamera);
els.capture.addEventListener('click', () => {
  try { captureFrame(); } catch (error) { setStatus(error.message, 'idle'); }
});
els.generate.addEventListener('click', generateTryOn);
els.closeResult.addEventListener('click', showCameraView);
els.saveResult.addEventListener('click', async () => {
  try {
    els.saveResult.disabled = true;
    setStatus('Preparing your photo…', 'busy');
    await saveResultImage();
  } catch (error) {
    setStatus(error.message || 'Could not save the photo.', stream ? 'live' : 'idle');
  } finally {
    els.saveResult.disabled = false;
  }
});
els.tryAnother.addEventListener('click', () => {
  showCameraView();
  openGarmentPicker();
});
els.changeGarment.addEventListener('click', openGarmentPicker);
els.garmentFile.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    garmentSource = await fileToDataUrl(file);
    els.garmentPreview.src = garmentSource;
    els.garmentPreview.style.display = 'block';
    els.garmentEmpty.style.display = 'none';
    els.garmentDescription.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    els.garmentFileLabel.textContent = file.name;
    showCameraView();
    els.generate.disabled = !personDataUrl;
    updateDeviceHelp();
    setStatus(personDataUrl ? 'New garment selected. Camera stays on; generate when ready.' : 'New garment selected.', stream ? 'live' : 'idle');
  } catch (error) {
    setStatus(error.message, 'idle');
  } finally {
    event.target.value = '';
  }
});

readQueryGarment();
setStatus(source === 'extension' ? 'Garment imported from the webpage. Start your camera.' : 'Ready.');
