// Presentation only: existing app.mjs owns parameter values and rendering.
const tools = [
  ['amount', '强度', '调整整款滤镜与原图的混合比例。'],
  ['exposure', '曝光', '调整画面整体明暗，单位为 EV。'],
  ['grain', '颗粒', '增加胶片纹理，放大查看更清楚。'],
  ['blackMistGrade', '黑柔', '六档使用原包系数；可见度增强默认关闭，手动增加属于本地调整。'],
  ['halationGrade', '光晕', '原版四档：不同通道的光线扩散与色彩补偿。'],
  ['vignette', '暗角', '压暗画面四周，突出中心。'],
];
const original = {exposure: 'ExposureSolidSun', kelvin: 'WhiteBalanceThermometer'};
const iconFile = key => key==='blackMistGrade'?'bloom.svg':key==='halationGrade'?'halation.svg': key === 'exposure' ? 'exposure.png' : key === 'kelvin' ? 'temperature.png' : `${key}.svg`;
function icon(key) {
  const img = document.createElement('img');
  img.src = new URL(`tool-assets/${iconFile(key)}`, import.meta.url).href;
  img.alt = '';
  img.width = img.height = 28;
  img.className = 'tool-icon';
  img.dataset.origin = original[key] ? 'original-app-asset' : 'local-illustration';
  return img;
}
const nav = document.createElement('div');
nav.className = 'tool-picker';
nav.setAttribute('role', 'group');
nav.setAttribute('aria-label', '选择显影工具');
const panel = document.createElement('div');
panel.className = 'tool-adjustment';
const hint = document.createElement('p');
hint.className = 'tool-hint';
hint.id = 'tool-hint';
document.querySelector('#amount').closest('.range-control').before(nav, panel);
const rows = tools.map(([key, title, description]) => {
  const row = document.querySelector(`#${key}`).closest('.range-control');
  row.id = `tool-panel-${key}`;
  row.classList.add('tool-slider');
  document.querySelector(`#${key}`).setAttribute('aria-describedby', hint.id);
  panel.append(row);
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.tool = key;
  button.setAttribute('aria-controls', row.id);
  button.setAttribute('aria-label', `${title}工具`);
  button.title = `${title} · ${original[key] ? `原包图标 ${original[key]}` : '本地图示'}`;
  const label = document.createElement('span');
  label.textContent = title;
  button.append(icon(key), label);
  nav.append(button);
  return {key, row, button, description};
});
panel.append(hint);
function select(key) {
  for (const item of rows) {
    const active = item.key === key;
    item.row.hidden = !active;
    item.button.setAttribute('aria-pressed', String(active));
    if (active) hint.textContent = item.description;
  }
}
for (const {key, button} of rows) button.addEventListener('click', () => select(key));
select('amount');
document.querySelector('.controls > .control-divider')?.remove();
document.querySelector('.controls > h3')?.remove();
for (const key of ['ccd', 'aberration', 'caPixels', 'node', 'kelvin']) {
  const label = document.querySelector(`label[for="${key}"]`);
  const name = document.createElement('span');
  name.className = 'parameter-name';
  name.title = original[key] ? `原包图标 ${original[key]}` : '本地图示';
  name.append(icon(key), document.createTextNode(label.firstChild.textContent.trim()));
  label.firstChild.replaceWith(name);
}
