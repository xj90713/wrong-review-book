import { cropRectangle, uploadQuestionImage, renderQuestionImage } from './question-images.js';

export function createImageEditor() {
  let value = null;
  let busy = false;
  let version = 0;
  let message = '';

  function notice(text) {
    message = text;
    const hint = document.getElementById('image-editor-status');
    if (hint) hint.textContent = text;
  }

  function clear() {
    version++;
    busy = false;
    value = null;
    message = '';
  }

  async function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    const token = ++version;
    busy = true;
    event.target.disabled = true;
    notice('正在保存原图…');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('图片不能超过 20MB。');
      const preview = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = preview;
        await img.decode();
      } catch { throw new Error('无法读取图片，请选择 PNG、JPEG、WebP 或 BMP 图片。'); }
      finally { URL.revokeObjectURL(preview); }
      const original = await uploadQuestionImage(file);
      if (token !== version) return;
      value = { original, crop: null };
      const source = document.querySelector('#mistake-form [name=source]');
      if (source) source.value = 'photo';
      notice('原图已准备好。可直接保存错题，也可拖动框选后点击“保存裁剪”。');
    } catch (error) {
      if (token === version) notice(error.message);
    } finally {
      if (token === version) { busy = false; mount(); }
    }
  }

  function mount() {
    const host = document.getElementById('question-image-editor');
    if (!host) return;
    const fileInput = document.getElementById('ocr-image-input');
    if (fileInput) fileInput.disabled = busy;
    host.innerHTML = `<p id="image-editor-status" class="hint" role="status"></p>${value ? `
      <p class="hint">在原图上拖动框选要保留的题目或图形。裁剪不会删除原图。</p>
      <canvas class="crop-canvas" aria-label="在原图上拖动框选裁剪区域"></canvas>
      <div class="crop-coordinates" aria-label="裁剪区域（原图像素）">
        <label>左边距<input data-coordinate="x" type="number" min="0" value="0" /></label>
        <label>上边距<input data-coordinate="y" type="number" min="0" value="0" /></label>
        <label>宽度<input data-coordinate="width" type="number" min="1" /></label>
        <label>高度<input data-coordinate="height" type="number" min="1" /></label>
      </div>
      <div class="action-row">
        <button type="button" data-image-action="crop" class="ghost" disabled>保存裁剪</button>
        <button type="button" data-image-action="reset" class="ghost">恢复整图</button>
        <button type="button" data-image-action="remove" class="ghost">移除图片</button>
      </div>
      <div class="image-saved-preview">${renderQuestionImage(value)}</div>` : ''}`;
    notice(message);
    const field = document.getElementById('mistake-original-question');
    if (field) field.required = !value;
    if (!value) return;
    const canvas = host.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const cropButton = host.querySelector('[data-image-action="crop"]');
    const inputs = [...host.querySelectorAll('[data-coordinate]')];
    let rect = null;
    let start = null;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (rect) {
        const sx = canvas.width / img.naturalWidth;
        const sy = canvas.height / img.naturalHeight;
        ctx.fillStyle = 'rgba(214, 156, 86, 0.2)';
        ctx.fillRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy);
        ctx.strokeStyle = '#b35e10';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x * sx, rect.y * sy, rect.width * sx, rect.height * sy);
      }
      cropButton.disabled = busy || !rect;
    };
    img.onload = () => {
      canvas.width = Math.min(img.naturalWidth, 1200);
      canvas.height = Math.round(img.naturalHeight * canvas.width / img.naturalWidth);
      inputs.find((i) => i.dataset.coordinate === 'width').value = img.naturalWidth;
      inputs.find((i) => i.dataset.coordinate === 'height').value = img.naturalHeight;
      draw();
    };
    img.onerror = () => notice('原图加载失败，请确认本地服务已启动。');
    img.src = value.original;
    const point = (event) => {
      const box = canvas.getBoundingClientRect();
      return { x: (event.clientX - box.left) / box.width * canvas.width, y: (event.clientY - box.top) / box.height * canvas.height };
    };
    const update = (event) => {
      if (!start) return;
      rect = cropRectangle(start, point(event), canvas.width, canvas.height, img.naturalWidth, img.naturalHeight);
      if (rect) for (const input of inputs) input.value = rect[input.dataset.coordinate];
      draw();
    };
    canvas.onpointerdown = (event) => {
      if (busy || !img.complete || !img.naturalWidth) return;
      start = point(event);
      canvas.setPointerCapture(event.pointerId);
    };
    canvas.onpointermove = update;
    canvas.onpointerup = (event) => { update(event); start = null; };
    canvas.onpointercancel = () => { start = null; };
    inputs.forEach((input) => input.addEventListener('input', () => {
      const values = Object.fromEntries(inputs.map((i) => [i.dataset.coordinate, Number(i.value)]));
      rect = values.width > 0 && values.height > 0 ? cropRectangle(
        { x: values.x, y: values.y }, { x: values.x + values.width, y: values.y + values.height },
        img.naturalWidth, img.naturalHeight, img.naturalWidth, img.naturalHeight
      ) : null;
      draw();
    }));
    cropButton.onclick = async () => {
      if (!rect || busy) return;
      const token = ++version;
      busy = true;
      draw();
      notice('正在保存裁剪图…');
      try {
        const output = document.createElement('canvas');
        output.width = rect.width;
        output.height = rect.height;
        output.getContext('2d').drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
        const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('裁剪失败，请缩小区域重试。');
        const crop = await uploadQuestionImage(blob);
        if (token !== version) return;
        value = { ...value, crop };
        notice('裁剪图已准备好，保存错题时将同时保留原图和裁剪图。');
      } catch (error) { if (token === version) notice(error.message); }
      finally { if (token === version) { busy = false; mount(); } }
    };
    host.querySelector('[data-image-action="reset"]').onclick = () => {
      if (busy) return;
      value = { ...value, crop: null };
      message = '已恢复使用完整原图。';
      mount();
    };
    host.querySelector('[data-image-action="remove"]').onclick = () => {
      if (busy) return;
      clear();
      const input = document.getElementById('ocr-image-input');
      if (input) input.value = '';
      mount();
    };
  }

  return { mount, selectFile, clear, get value() { return value; }, get busy() { return busy; } };
}
