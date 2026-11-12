const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlPath = path.resolve(__dirname, 'home-premium.html');
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

async function run() {
  const tmpDir = path.join(process.env.TEMP, 'chrome-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + tmpDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--allow-file-access-from-files',
    fileUrl
  ]);

  let port = null;
  const activePortFile = path.join(tmpDir, 'DevToolsActivePort');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (fs.existsSync(activePortFile)) {
      const content = fs.readFileSync(activePortFile, 'utf8').trim().split('\n');
      port = parseInt(content[0], 10);
      break;
    }
  }

  if (!port) {
    chromeProc.kill();
    throw new Error('Could not find active DevTools port');
  }

  // Get pages
  const pages = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = pages.find(p => p.type === 'page');
  const ws = new (require('events').EventEmitter)();
  const WebSocket = require('net');

  // Simple WebSocket client for CDP
  const wsUrl = new URL(page.webSocketDebuggerUrl);
  const client = WebSocket.createConnection({ host: wsUrl.hostname, port: wsUrl.port });

  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      const payload = JSON.stringify({ id: msgId, method, params });
      
      // Construct WS text frame
      const buf = Buffer.from(payload, 'utf8');
      let header;
      if (buf.length < 126) {
        header = Buffer.from([0x81, 0x80 | buf.length, 0, 0, 0, 0]);
      } else {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(buf.length, 2);
      }
      // mask
      const masked = Buffer.alloc(buf.length);
      const mask = [0, 0, 0, 0];
      for (let i = 0; i < buf.length; i++) {
        masked[i] = buf[i] ^ mask[i % 4];
      }
      client.write(Buffer.concat([header, masked]));
    });
  }

  let buffer = Buffer.alloc(0);
  client.on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const secondByte = buffer[1];
      let length = secondByte & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) break;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) break;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (buffer.length < offset + length) break;
      const data = buffer.slice(offset, offset + length).toString('utf8');
      buffer = buffer.slice(offset + length);
      try {
        const msg = JSON.parse(data);
        if (msg.id && callbacks.has(msg.id)) {
          const cb = callbacks.get(msg.id);
          callbacks.delete(msg.id);
          if (msg.error) cb.reject(msg.error);
          else cb.resolve(msg.result);
        }
      } catch (e) {}
    }
  });

  // Wait for WS connection
  await new Promise(resolve => {
    const key = Buffer.from('test-key-12345678').toString('base64');
    const req = `GET ${wsUrl.pathname} HTTP/1.1\r\nHost: ${wsUrl.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`;
    client.write(req);
    client.once('data', () => resolve());
  });

  // Enable Page and Runtime
  await send('Page.enable');
  await send('Runtime.enable');

  const viewports = [320, 360, 375, 390, 414, 430];
  const results = [];

  for (const width of viewports) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 800,
      deviceScaleFactor: 1,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 250));

    const evalResult = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const root = document.getElementById('cost-estimator');
          const grid = root.querySelector('.estimator-discipline-grid') || root.querySelector('.grid');
          const btns = Array.from(root.querySelectorAll('.estimator-discipline-btn'));
          const container = grid.parentElement;
          const containerRect = container.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();

          const btnData = btns.map(b => {
            const r = b.getBoundingClientRect();
            return {
              text: b.textContent.trim(),
              left: Math.round(r.left),
              right: Math.round(r.right),
              top: Math.round(r.top),
              bottom: Math.round(r.bottom),
              width: Math.round(r.width),
              height: Math.round(r.height),
              scrollWidth: b.scrollWidth,
              clientWidth: b.clientWidth,
              textClipped: b.scrollWidth > b.clientWidth,
              overflowsParent: r.right > containerRect.right + 1,
              overflowsGrid: r.right > gridRect.right + 1
            };
          });

          // Detect columns by inspecting distinct left coordinates
          const distinctLefts = Array.from(new Set(btnData.map(b => b.left)));

          // Check slider & labels
          const slider = root.querySelector('#estimator-sqft-slider');
          const sliderRect = slider.getBoundingClientRect();
          const sliderLabels = slider.nextElementSibling;
          const labelsRect = sliderLabels.getBoundingClientRect();

          // Check tier buttons
          const tierBtns = Array.from(root.querySelectorAll('.estimator-tier-btn'));
          const tierData = tierBtns.map(t => {
            const r = t.getBoundingClientRect();
            return {
              text: t.querySelector('.font-semibold')?.textContent.trim(),
              overflowsParent: r.right > containerRect.right + 1,
              textClipped: t.scrollWidth > t.clientWidth
            };
          });

          // Check output box & CTA
          const outputBox = root.querySelector('.bg-\\[\\#151413\\]');
          const outputRect = outputBox ? outputBox.getBoundingClientRect() : null;
          const ctaBtn = root.querySelector('#estimator-book-btn');
          const ctaRect = ctaBtn ? ctaBtn.getBoundingClientRect() : null;

          return {
            windowWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
            containerWidth: Math.round(containerRect.width),
            gridWidth: Math.round(gridRect.width),
            columns: distinctLefts.length,
            buttons: btnData,
            sliderOverflow: sliderRect.right > containerRect.right + 1,
            labelsOverflow: labelsRect.right > containerRect.right + 1,
            tiersAllFit: tierData.every(t => !t.overflowsParent && !t.textClipped),
            outputBoxOverflow: outputRect ? outputRect.right > containerRect.right + 1 : false,
            ctaOverflow: ctaRect ? ctaRect.right > containerRect.right + 1 : false
          };
        })()
      `,
      returnByValue: true
    });

    results.push(evalResult.result.value);
  }

  // Interactive test: click Commercial button, test state & rates
  const interactiveTest = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const root = document.getElementById('cost-estimator');
        const commercialBtn = root.querySelector('.estimator-discipline-btn[data-discipline="commercial"]');
        const residentialBtn = root.querySelector('.estimator-discipline-btn[data-discipline="residential"]');
        
        commercialBtn.click();

        const commClasses = commercialBtn.className;
        const resClasses = residentialBtn.className;
        const rateText = root.querySelector('#estimator-rate-sqft')?.textContent.trim();
        const costText = root.querySelector('#estimator-cost-display')?.textContent.trim();

        // Switch to Haute tier
        const hauteBtn = root.querySelector('.estimator-tier-btn[data-tier="haute"]');
        hauteBtn.click();
        const hauteRate = root.querySelector('#estimator-rate-sqft')?.textContent.trim();
        const hauteCost = root.querySelector('#estimator-cost-display')?.textContent.trim();

        return {
          commercialActive: commClasses.includes('bg-brand-secondary') && commClasses.includes('font-bold'),
          residentialInactive: !resClasses.includes('bg-brand-secondary') && resClasses.includes('border-[#3D3A36]'),
          rateAfterCommercial: rateText,
          costAfterCommercial: costText,
          rateAfterHaute: hauteRate,
          costAfterHaute: hauteCost
        };
      })()
    `,
    returnByValue: true
  });

  client.destroy();
  chromeProc.kill();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}

  console.log(JSON.stringify({ viewports: results, interactive: interactiveTest.result.value }, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

