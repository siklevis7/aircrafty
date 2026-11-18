// SVG gauge builders for the engine start trainer (EICAS-style round dials and the duct pressure gauge).
const P = 'tr-enginestart-';
const A0 = -110, A1 = 100; // dial sweep, degrees clockwise from 12 o'clock

export function pol(cx, cy, r, a) {
  const t = (a * Math.PI) / 180;
  return [+(cx + r * Math.sin(t)).toFixed(2), +(cy - r * Math.cos(t)).toFixed(2)];
}
function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = pol(cx, cy, r, a0), [x1, y1] = pol(cx, cy, r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
function sector(cx, cy, r, a0, a1) {
  if (a1 <= a0 + 0.2) return '';
  const [x0, y0] = pol(cx, cy, r, a0), [x1, y1] = pol(cx, cy, r, a1);
  return `M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

/** Round EICAS dial. Returns { id, svg, bind(root) → update(value, state, opts) } and stringifies to svg. */
export function dial(o) {
  const { id, cx, cy, r, min, max, ticks = [], tickLabels, red, startRed, digits = 0, small, nofill, redSide } = o;
  const ang = (v) => A0 + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (A1 - A0);
  const tk = ticks.map((t, i) => {
    const [x0, y0] = pol(cx, cy, r, ang(t)), [x1, y1] = pol(cx, cy, r - (small ? 5 : 8), ang(t));
    let lbl = '';
    if (tickLabels) {
      const [lx, ly] = pol(cx, cy, r - 17, ang(t));
      lbl = `<text x="${lx}" y="${ly + 4}" text-anchor="middle" class="${P}d-tick">${tickLabels[i]}</text>`;
    }
    return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${P}d-tk"/>${lbl}`;
  }).join('');
  const radial = (v, cls, extra = '') => {
    const [x0, y0] = pol(cx, cy, r - (small ? 6 : 10), ang(v)), [x1, y1] = pol(cx, cy, r + (small ? 4 : 7), ang(v));
    return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${cls}" ${extra}/>`;
  };
  let box;
  const bw = small ? 44 : 66, bh = small ? 20 : 26;
  let bx, by, tx, anchor = 'end';
  if (small === 'left') { bx = cx - r - 8 - bw; by = cy - bh / 2; }
  else if (small === 'right') { bx = cx + r + 8; by = cy - bh / 2; }
  else { bx = cx + 2; by = cy - r - bh - 6; }
  tx = bx + bw - 6;
  box = `<rect data-r="box" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="2" class="${P}d-box"/>
    <text data-r="txt" x="${tx}" y="${by + bh - (small ? 5 : 6)}" text-anchor="${anchor}" class="${P}d-num${small ? ` ${P}d-num-s` : ''}">0</text>`;
  const svg = `<g class="${P}dial" data-d="${id}">
    ${nofill ? '' : `<path data-r="fill" class="${P}d-fill" d=""/>`}
    <path class="${P}d-arc" d="${arc(cx, cy, r, A0, A1)}"/>
    ${tk}
    ${red != null ? radial(red, `${P}d-red`) : ''}
    ${redSide === 'low' && red != null ? `<path class="${P}d-redarc" d="${arc(cx, cy, r, A0, ang(red))}"/>` : ''}
    ${startRed != null ? radial(startRed, `${P}d-red ${P}d-sred`, 'data-r="sred"') : ''}
    <line data-r="needle" x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - r + (small ? 3 : 4)}" class="${P}d-needle"/>
    <circle cx="${cx}" cy="${cy}" r="${small ? 2 : 3}" class="${P}d-hub"/>
    ${box}
  </g>`;
  return {
    id, svg, toString() { return svg; },
    bind(root) {
      const g = root.querySelector(`[data-d="${id}"]`);
      const needle = g.querySelector('[data-r="needle"]');
      const fill = g.querySelector('[data-r="fill"]');
      const txt = g.querySelector('[data-r="txt"]');
      const sred = g.querySelector('[data-r="sred"]');
      let last = '';
      return (v, state = '', opts = {}) => {
        const a = ang(v);
        needle.setAttribute('transform', `rotate(${a.toFixed(2)} ${cx} ${cy})`);
        fill?.setAttribute('d', sector(cx, cy, r - 1, A0, a));
        txt.textContent = v.toFixed(digits);
        if (state !== last) { g.dataset.state = state; last = state; }
        if (sred) sred.style.display = opts.startRed === false ? 'none' : '';
      };
    },
  };
}

/** Dual-pointer duct pressure gauge (L / R), 0–80 psi. */
export function ductGauge(cls) {
  const cx = 60, cy = 62, r = 46, a0 = -130, a1 = 130, max = 80;
  const ang = (v) => a0 + (Math.min(max, Math.max(0, v)) / max) * (a1 - a0);
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80].map((v) => {
    const big = v % 20 === 0;
    const [x0, y0] = pol(cx, cy, r, ang(v)), [x1, y1] = pol(cx, cy, r - (big ? 8 : 5), ang(v));
    const [lx, ly] = pol(cx, cy, r - 16, ang(v));
    return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" class="${P}g-tk"/>${big ? `<text x="${lx}" y="${ly + 3.5}" text-anchor="middle" class="${P}g-tl">${v / 10}</text>` : ''}`;
  }).join('');
  const ptr = (k) => { const tr = k === "L" ? r - 25 : r - 36; return `<g data-p="${k}"><path d="M${cx - 2.6} ${cy} L${cx} ${cy - r + 6} L${cx + 2.6} ${cy} Z" class="${P}g-ptr"/>
    <circle cx="${cx}" cy="${cy - tr}" r="5.5" class="${P}g-ptrtag"/><text x="${cx}" y="${cy - tr + 3}" text-anchor="middle" class="${P}g-ptrl">${k}</text></g>`; };
  const svg = `<svg class="${cls}" viewBox="0 0 120 112" role="img" aria-label="Duct pressure gauge">
    <circle cx="${cx}" cy="${cy}" r="${r + 7}" class="${P}g-bezel"/><circle cx="${cx}" cy="${cy}" r="${r + 2}" class="${P}g-face"/>
    ${ticks}
    <text x="${cx}" y="${cy + 20}" text-anchor="middle" class="${P}g-cap">DUCT</text>
    <text x="${cx}" y="${cy + 29}" text-anchor="middle" class="${P}g-cap">PRESS</text>
    <text x="${cx}" y="${cy + 38}" text-anchor="middle" class="${P}g-cap2">PSI ×10</text>
    ${ptr('L')}${ptr('R')}
    <circle cx="${cx}" cy="${cy}" r="4" class="${P}g-hub"/>
  </svg>`;
  return {
    svg,
    bind(root) {
      const L = root.querySelector(`.${cls} [data-p="L"]`), R = root.querySelector(`.${cls} [data-p="R"]`);
      return (l, rr) => {
        L.setAttribute('transform', `rotate(${ang(l).toFixed(2)} ${cx} ${cy})`);
        R.setAttribute('transform', `rotate(${ang(rr).toFixed(2)} ${cx} ${cy})`);
      };
    },
  };
}
