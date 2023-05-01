import * as decode from '@paulmillr/qr/decode';
import writeQR from '@paulmillr/qr';

let IS_STARTED_VIDEO = false;

const pad = (n, z = 2) => ('' + n).padStart(z, '0');

const time = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}:${pad(
    d.getMilliseconds(),
    3
  )}`;
};

const log = (...txt) => {
  const el = document.querySelector('#log');
  el.innerHTML = `${time()} ${txt.join(' ').replace('\n', '<br>')}<hr>` + el.innerHTML;
};

const error = (...txt) => log('[<span class="qr-error">ERROR</span>]', ...txt);
const ok = (...txt) => log('[<span class="qr-ok">OK</span>]', ...txt);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSize = (img) => ({
  width: +getComputedStyle(img).width.split('px')[0],
  height: +getComputedStyle(img).height.split('px')[0],
});

function main() {
  const SLEEP_MS = 1; // ms to sleep between detection, to avoid 100% cpu usage
  const TIMEOUT_MS = 500; // if there was no detection for timeout ms - clear overlay

  let lastDetect = Date.now();
  let ctx;
  const canvas = document.createElement('canvas');
  ok('Started');
  const player = document.querySelector('video');
  const overlay = document.querySelector('#overlay');
  const resultTxt = document.querySelector('#resultTxt');
  const resultTxtLabel = document.querySelector('#resultTxtLabel');
  const resultQr = document.querySelector('#resultQr');
  const isDrawQr = document.querySelector('#isDrawQr');
  const isLogDecoded = document.querySelector('#isLogDecoded');
  const imgEncodeQr = document.querySelector('#encResultQr');
  const inputEncode = document.querySelector('#input-encode');
  const resultsContainer = document.querySelector('#results-container');

  const detectFn = (points) => {
    //ok('DETECTED', JSON.stringify(points));
    try {
      lastDetect = Date.now();
      const [tl, tr, br, bl] = points;
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.fill();
      ctx.fillStyle = 'blue';
      for (const p of points) {
        // Finder is is pixels
        let x = p.x - 3 * p.moduleSize;
        let y = p.y - 3 * p.moduleSize;
        const size = 7 * p.moduleSize;
        ctx.fillRect(x, y, size, size);
      }
    } catch (e) {
      error('detectFn', e);
    }
  };

  const qrFn = (img) => {
    try {
      if (!isDrawQr.checked) return;
      const { data, height, width } = img;
      resultQr.width = width;
      resultQr.height = height;
      const ctx = resultQr.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      //ok('qrFn', `data=${data.length} h=${height} w=${width}`);
      const imgData = new ImageData(Uint8ClampedArray.from(data), width, height);
      ctx.putImageData(imgData, 0, 0);
      resultQr.style = `image-rendering: pixelated;width: ${8 * width}px; height: ${8 * height}px`;
    } catch (e) {
      error('qrFn', e);
    }
  };

  const overlayLoop = async () => {
    while (true) {
      if (!ctx) {
        await sleep(200);
        continue;
      }
      const { context, width, height } = ctx;
      let ts = Date.now();
      context.drawImage(player, 0, 0, width, height);
      const data = context.getImageData(0, 0, height, width);
      try {
        const res = decode.default(data, { detectFn, qrFn });
        if (isLogDecoded.checked) ok('Decoded', `"${res}"`, `${Date.now() - ts} ms`);
        resultTxt.innerText = res;
        resultTxtLabel.style.display = 'inline';
      } catch (e) {
        if (Date.now() - lastDetect > TIMEOUT_MS) {
          const ctx = overlay.getContext('2d');
          ctx.clearRect(0, 0, overlay.width, overlay.height);
        }
      }
      await sleep(SLEEP_MS);
    }
  };

  document.querySelector('video').addEventListener('play', () => {
    // We won't have correct size until video starts playing
    const { height, width } = getSize(player);
    ok(`Got video feed h=${height} w=${width}`);
    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;
    ctx = { context: canvas.getContext('2d'), height, width };
    overlayLoop();
  });

  document.querySelector('#startBtn').addEventListener('click', async (e) => {
    const btn = e.target;
    if (!IS_STARTED_VIDEO) {
      try {
        player.setAttribute('autoplay', '');
        player.setAttribute('muted', '');
        player.setAttribute('playsinline', '');
        const options = { video: true };
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isIOS) {
          // Force iOS to use front-facing camera
          options.video = {
            // Force bigger resolution
            height: window.screen.height,
            width: window.screen.width,
            facingMode: {
              exact: 'environment',
            },
          }
        }
        const stream = await navigator.mediaDevices.getUserMedia(options);
        player.srcObject = stream;
        player.style.display = 'block';
        btn.innerText = 'Stop';
        IS_STARTED_VIDEO = true;
      } catch (e) {
        error('Media loop', e);
      }
    } else {
      player.srcObject.getTracks().forEach((track) => track.stop());
      btn.innerText = 'Start video capturing';
      const { height, width } = getSize(player);
      resultsContainer.style.height = `${height}px`;
      resultsContainer.style.width = `${width}px`;
      IS_STARTED_VIDEO = false;
    }
  });

  const qrGifDataUrl = (text) => {
    const gifBytes = writeQR(text, 'gif', {
      scale: 7,
    });
    const blob = new Blob([gifBytes], { type: 'image/gif' });
    return URL.createObjectURL(blob);
  }

  inputEncode.addEventListener('input', (e) => {
    const text = e.target.value;
    imgEncodeQr.src = qrGifDataUrl(text);
  });
  
  imgEncodeQr.src = qrGifDataUrl(inputEncode.value);
}

window.addEventListener('load', main);
