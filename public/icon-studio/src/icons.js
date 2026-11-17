// Copyright (c) 2026 Kubai087. Licensed under the Kubai Icons License; see LICENSE.
// The icon set. Each entry: svg(u) builds the layers, target(hover, state) returns the
// numbers for rest or hover, draw(p, E) writes the interpolated numbers back. A contributed
// icon also names its designer's GitHub handle in `by`.

// ---------- Icons ----------
// Fills: u.lo(h) / u.up(h) carry the thin bottom band. Use them only on a flat-bottomed
// rectangle of height h whose bottom is clear: nothing within about 3 units of the edge
// and the piece itself not short. Everything else, and curved shapes, use u.loS / u.upS.
// Marks: on a mid-tone (back) body they are white; on a light (front) body or white
// content they take the deep tint; a supporting object laid over the subject (the
// lens) is deep so it reads as separate. Weights: content lines 1.6, glyphs 2.2.
const OL = 'class="ol" data-t="stroke:#5393FF"';
const LINE = 'class="ln" data-t="stroke:#D3E2FC"';
const ACC = 'class="ln" data-t="stroke:#5393FF"';
const DEEP = 'data-t="fill:#2F6FE0"';
const DEEPS = 'data-t="stroke:#2F6FE0"';
const FOLDER_BACK_R = [KR, 1.4, 1.4, KR, KR, KR];
// Keylines (fills; outside strokes add 1 all round), all centred on (15.5, 12.5) and scaled from the folder's 23-wide body
// (Material's 20 / 18 / 20×16 grid × 1.15): circle Ø23, square 20.6, landscape 23×18.4,
// portrait 18.4×23. Outlines sit 1 unit outside a shape; a coloured band around white
// content keeps 2+ units or is dropped so the content meets the edge.
const TRASH_LID = rp([[5.4, 6.6], [5.4, 4], [12.4, 4], [12.4, 1.6], [18.6, 1.6], [18.6, 4], [25.6, 4], [25.6, 6.6]], [1, 1, 0.5, 0.8, 0.8, 0.5, 1, 1]);
const GEAR = gear(6, 11.4, 9);
  const MAIL_T = 3.3;
const today = new Date();
const tomorrow = new Date(today.getTime() + 86400000);

// A capsule ring centred on the origin: outer w×h, wall t (fill-rule evenodd).
const capsuleRing = (w, h, t) => rr(-w / 2, -h / 2, w, h, h / 2) + rr(-w / 2 + t, -h / 2 + t, w - 2 * t, h - 2 * t, (h - 2 * t) / 2);
const LINK_RING = capsuleRing(15.6, 9.6, 2.8);
// An arc of radius r round the origin from angle a0 to a1 (degrees, clockwise), and a
// solid arrowhead whose base covers the arc's end. Strokes never overlap one another,
// so the head stays crisp instead of clotting where strokes would cross.
function arcArrow(a0, a1, r) {
  const rad = (d) => d * Math.PI / 180;
  const pt = (a) => [r * Math.cos(rad(a)), r * Math.sin(rad(a))];
  const s = pt(a0), e = pt(a1);
  const t = [-Math.sin(rad(a1)), Math.cos(rad(a1))], n = [Math.cos(rad(a1)), Math.sin(rad(a1))];
  const tip = [e[0] + t[0] * 3, e[1] + t[1] * 3];
  const head = rp([[e[0] + n[0] * 2.5, e[1] + n[1] * 2.5], tip, [e[0] - n[0] * 2.5, e[1] - n[1] * 2.5]], 0.5);
  return { arc: `M${f(s[0])} ${f(s[1])}A${r} ${r} 0 0 1 ${f(e[0])} ${f(e[1])}`, head };
}
// Each arrow's tip stops well short of the other arc's tail.
const SYNC_A = arcArrow(215, 300, 4.4), SYNC_B = arcArrow(35, 120, 4.4);
const SHORTCUT_TILES = [[7.2, 4.2], [16.5, 4.2], [7.2, 13.5], [16.5, 13.5]];

const ICONS = [
  {
    name: '照片',
    // Two prints, one behind the other: on hover the back one fans out to the left and
    // the front one tilts, like leafing through an album.
    svg: (u) => {
      const frame = rr(4, 5.6, 23, 16.1, KR), back = rr(6, 3.3, 19, 15, KR);
      return `
      <g data-n="back"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${back}" fill="${u.lo(15)}"/></g></g><path d="${back}" ${OL}/></g>
      <g data-n="front">
        <clipPath id="${u.id('sky')}"><path d="${frame}"/></clipPath>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${frame}" fill="${u.upS}"/></g></g>
        <g clip-path="url(#${u.id('sky')})">
          <circle cx="20.4" cy="9.8" r="2.5" fill="#fff"/>
          <path d="${rp([[-1, 23], [-1, 20.2], [10.6, 10.8], [23, 20.8], [23, 23]], [0, 0, 1.8, 0, 0])}" fill="${u.loS}"/>
          <path d="${rp([[8, 23], [8, 21.4], [19.8, 13.2], [32, 20.8], [32, 23]], [0, 0, 1.8, 0, 0])}" fill="${u.pure('#5393FF')}"/>
        </g>
        <path d="${frame}" ${OL}/>
      </g>`;
    },
    target: (h) => ({ back: h ? [-1.4, -1.2, -9] : [0, 0, 0], front: h ? [0.6, 0.2, 4] : [0, 0, 0] }),
    draw(p, E) {
      at(E.back, { transform: `translate(${f(p.back[0])} ${f(p.back[1])}) rotate(${f(p.back[2])} 15.5 21.7)` });
      at(E.front, { transform: `translate(${f(p.front[0])} ${f(p.front[1])}) rotate(${f(p.front[2])} 15.5 21.7)` });
    }
  },
  {
    name: '上传',
    // Back: the cloud. Front: a lighter section cut from its lower part, like the
    // folder's front panel. The arrow sits clear above the front and lifts on hover.
    svg: (u) => `
      <g filter="${u.sh}"><g filter="${u.hi}"><path data-n="cloud" fill="${u.loS}"/></g></g>
      <path data-n="cloudO" ${OL}/>
      <path data-n="arrow" fill="none" stroke="#fff" data-w="stroke" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <g filter="${u.hi}"><path data-n="front" fill="${u.upS}"/></g>
      <path data-n="frontO" ${OL}/>`,
    target: (h) => ({
      L: [9.2, 15.8, h ? 6.3 : 6], T: [15.8, 9.6, h ? 8.4 : 8], Rc: [22.2, 16.2, h ? 5.9 : 5.6],
      tip: h ? 4.8 : 6.4,
      chord: h ? 17.6 : 16.8
    }),
    draw(p, E) {
      const d = cloud(p.L, p.T, p.Rc);
      at(E.cloud, { d }); at(E.cloudO, { d });
      const t = p.tip;
      at(E.arrow, { d: `M15.5 ${f(t + 7.6)}V${f(t)}M12.1 ${f(t + 3.4)}L15.5 ${f(t)}L18.9 ${f(t + 3.4)}` });
      const fr = frontPiece(p.L, p.Rc, p.chord, 2);
      at(E.front, { d: fr }); at(E.frontO, { d: fr });
    }
  },
  {
    name: '下载',
    // Back: the disc. Front: a lighter lower segment. The arrow follows the front down
    // on hover and always stays clear of it.
    svg: (u) => {
      const r = 11.5;
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(15.5, 12.5, r)}" fill="${u.loS}"/></g></g>
      <path d="${circ(15.5, 12.5, r)}" ${OL}/>
      <path data-n="arrow" fill="none" stroke="#fff" data-w="stroke" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <g filter="${u.hi}"><path data-n="seg" fill="${u.upS}"/></g>
      <path data-n="segO" ${OL}/>`;
    },
    target: (h) => ({ tip: h ? 13.4 : 12.4, chord: h ? 16.6 : 15.6 }),
    draw(p, E) {
      const t = p.tip;
      at(E.arrow, { d: `M15.5 ${f(t - 9.4)}V${f(t)}M11.9 ${f(t - 3.6)}L15.5 ${f(t)}L19.1 ${f(t - 3.6)}` });
      const disc = [15.5, 12.5, 11.5];
      const seg = frontPiece(disc, disc, p.chord, 2);
      at(E.seg, { d: seg }); at(E.segO, { d: seg });
    }
  },
  {
    name: '链接',
    // Two links of a chain; hover draws them tighter.
    svg: (u) => `
      <g data-n="g">
        <g data-n="a"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${LINK_RING}" fill-rule="evenodd" fill="${u.loS}"/></g></g><path d="${LINK_RING}" fill-rule="evenodd" ${OL}/></g>
        <g data-n="bb"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${LINK_RING}" fill-rule="evenodd" fill="${u.upS}"/></g></g><path d="${LINK_RING}" fill-rule="evenodd" ${OL}/></g>
      </g>`,
    target: (h) => ({ gap: h ? 3.5 : 4.2, rot: h ? -40 : -45 }),
    draw(p, E) {
      at(E.g, { transform: `rotate(${f(p.rot)} 15.5 12.5)` });
      at(E.a, { transform: `translate(${f(15.5 - p.gap)} 12.5)` });
      at(E.bb, { transform: `translate(${f(15.5 + p.gap)} 12.5)` });
    }
  },
  {
    name: '同步',
    // A dial with two chasing arrows that turn half a revolution on hover.
    svg: (u) => `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(15.5, 12.5, 11.5)}" fill="${u.loS}"/></g></g>
      <path d="${circ(15.5, 12.5, 11.5)}" ${OL}/>
      <g filter="${u.hi}"><path d="${circ(15.5, 12.5, 8)}" fill="${u.upS}"/></g>
      <path d="${circ(15.5, 12.5, 8)}" ${OL}/>
      <g data-n="arr"><path d="${SYNC_A.arc}${SYNC_B.arc}" fill="none" stroke-width="2.2" stroke-linecap="round" data-t="stroke:#2F6FE0"/><path d="${SYNC_A.head}${SYNC_B.head}" data-t="fill:#2F6FE0"/></g>`,
    target: (h) => ({ rot: h ? 180 : 0 }),
    draw(p, E) {
      at(E.arr, { transform: `translate(15.5 12.5) rotate(${f(p.rot)})` });
    }
  },
  {
    name: '外观',
    // Light and dark halves of one disc; hover turns the light half across.
    svg: (u) => {
      const disc = [15.5, 12.5, 11.5], half = frontPiece(disc, disc, 12.5, 2);
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(15.5, 12.5, 11.5)}" fill="${u.loS}"/></g></g>
      <path d="${circ(15.5, 12.5, 11.5)}" ${OL}/>
      <g filter="${u.hi}"><g data-n="half"><path d="${half}" fill="${u.upS}"/></g></g>
      <g data-n="halfO"><path d="${half}" ${OL}/></g>`;
    },
    target: (h) => ({ rot: h ? 90 : -90 }),
    draw(p, E) {
      const t = `rotate(${f(p.rot)} 15.5 12.5)`;
      at(E.half, { transform: t }); at(E.halfO, { transform: t });
    }
  },
  {
    name: '聊天',
    // Two speech bubbles; the reply in front starts typing on hover.
    svg: (u) => {
      const back = rr(4, 3.3, 16, 11.6, KR);
      const front = rp([[10.2, 8.8], [27, 8.8], [27, 19], [17.4, 19], [13.8, 22.6], [13.8, 19], [10.2, 19]], [KR, KR, KR, 0.5, 0.6, 0.5, KR]);
      return `<g data-n="b"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${back}" fill="${u.loS}"/></g></g><path d="${back}" ${OL}/>
          <path d="${lines(7, 6.8, [6.4])}" class="ln" stroke="#fff" data-w="stroke"/></g>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${front}" fill="${u.upS}"/></g></g><path d="${front}" ${OL}/>
        <circle data-n="d1" cx="14.6" r="1.4" ${DEEP}/><circle data-n="d2" cx="18.6" r="1.4" ${DEEP}/><circle data-n="d3" cx="22.6" r="1.4" ${DEEP}/>`;
    },
    target: (h) => ({ d: h ? [-0.6, -1.5, -0.6] : [0, 0, 0], b: h ? -0.8 : 0 }),
    draw(p, E) {
      at(E.d1, { cy: f(13.9 + p.d[0]) }); at(E.d2, { cy: f(13.9 + p.d[1]) }); at(E.d3, { cy: f(13.9 + p.d[2]) });
      at(E.b, { transform: `translate(${f(p.b)} ${f(p.b)})` });
    }
  },
  {
    name: '手机',
    // A phone whose notification card slides in on hover.
    svg: (u) => {
      const body = rr(7.3, 1, 16.4, 23, 3.4), card = rr(0, 0, 10.4, 4.4, 1.4);
      return `<g data-n="ph">
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g><path d="${body}" ${OL}/>
        <path d="${rr(9.4, 3.4, 12.2, 16.6, CR)}" fill="#fff"/>
        <g data-n="card"><g filter="${u.hi}"><path d="${card}" fill="${u.upS}"/></g><path d="${card}" ${OL}/><path d="${lines(1.8, 2, [4.4])}" class="ln" ${DEEPS}/></g>
      </g>`;
    },
    target: (h) => ({ card: h ? [10.3, 6.2, 1] : [10.3, 3.4, 0], tilt: h ? -5 : 0 }),
    draw(p, E) {
      at(E.card, { transform: `translate(${f(p.card[0])} ${f(p.card[1])})`, opacity: f(p.card[2]) });
      at(E.ph, { transform: `rotate(${f(p.tilt)} 15.5 12.5)` });
    }
  },
  {
    name: '音乐',
    // Two beamed notes that bounce on hover.
    svg: (u) => {
      const stems = rp([[12.4, 5], [25, 2.4], [25, 17.2], [22.8, 17.2], [22.8, 6.6], [14.6, 8.4], [14.6, 19.2], [12.4, 19.2]], [0.8, 0.8, 0.6, 0.6, 0.3, 0.3, 0.6, 0.6]);
      const head = (cx, cy) => `M${f(cx - 3.6)} ${f(cy)}A3.6 2.7 0 1 0 ${f(cx + 3.6)} ${f(cy)}A3.6 2.7 0 1 0 ${f(cx - 3.6)} ${f(cy)}Z`;
      const heads = head(10.8, 19.4) + head(21, 17.4);
      return `<g data-n="g">
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${stems}" fill="${u.loS}"/></g></g><path d="${stems}" ${OL}/>
        <g transform="rotate(-18 15.9 18.4)"><g filter="${u.hi}"><path d="${heads}" fill="${u.upS}"/></g><path d="${heads}" ${OL}/></g>
      </g>`;
    },
    target: (h) => ({ y: h ? -1.4 : 0, a: h ? -6 : 0 }),
    draw(p, E) { at(E.g, { transform: `translate(0 ${f(p.y)}) rotate(${f(p.a)} 15.5 12.5)` }); }
  },
  {
    name: '视频',
    // A video camera; its lens opens wider and the record light grows on hover.
    svg: (u) => {
      const body = rr(4, 6, 15.8, 13, KR);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g><path d="${body}" ${OL}/>
        <g filter="${u.hi}"><path data-n="lens" fill="${u.upS}"/></g><path data-n="lensO" ${OL}/>
        <circle data-n="dot" cx="8.8" cy="10.4" fill="#fff" data-w="fill"/>`;
    },
    target: (h) => ({ w: h ? [8.6, 6.2] : [7.6, 4.8], dot: h ? 2.3 : 1.8 }),
    draw(p, E) {
      const [wx, wy] = p.w;
      const d = rp([[18.6, 9.6], [18.6 + wx, 12.5 - wy], [18.6 + wx, 12.5 + wy], [18.6, 15.4]], [0.6, 1.4, 1.4, 0.6]);
      at(E.lens, { d }); at(E.lensO, { d });
      at(E.dot, { r: f(p.dot) });
    }
  },
  {
    name: '编辑',
    // A pencil that writes a line on hover.
    svg: (u) => {
      const body = rr(7.1, 9.6, 15, 6.8, 0.8), tip = rp([[22.1, 9.6], [28.4, 13], [22.1, 16.4]], [0.3, 0.9, 0.3]), cap = rr(2.8, 9.6, 4.7, 6.8, 2);
      return `<path data-n="ink" fill="none" stroke-width="2.2" stroke-linecap="round" ${DEEPS}/>
        <g filter="${u.sh}"><g filter="${u.hi}"><g data-n="pen"><path d="${body}" fill="${u.loS}"/><path d="${tip}" fill="${u.upS}"/><path d="${cap}" fill="${u.upS}"/></g></g></g>
        <g data-n="penO"><path d="${body}" ${OL}/><path d="${tip}" ${OL}/><path d="${cap}" ${OL}/></g>`;
    },
    target: (h) => ({ push: h ? 1.6 : 0, ink: h ? 9 : 0 }),
    draw(p, E) {
      const t = `rotate(135 15.5 13) translate(${f(p.push)} 0)`;
      at(E.pen, { transform: t }); at(E.penO, { transform: t });
      at(E.ink, { d: `M6.4 23.6H${f(6.4 + p.ink)}`, opacity: p.ink > 0.2 ? 1 : 0 });
    }
  },
  {
    name: '剪贴板',
    // A clipboard; a check gets ticked on its sheet on hover.
    svg: (u) => {
      const board = rr(6.3, 2.6, 18.4, 21.2, KR), clip = rp(R(11, 0.8, 9, 4.6), [1.6, 1.6, 1.2, 1.2]);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${board}" fill="${u.loS}"/></g></g><path d="${board}" ${OL}/>
        <path d="${rr(8.6, 6.6, 13.8, 15, CR)}" fill="#fff"/>
        <path d="${lines(11, 10.2, [9])}" ${LINE}/>
        <path data-n="chk" d="M12.2 16.2L14.6 18.6L19 14" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${DEEPS}/>
        <g filter="${u.hi}"><path d="${clip}" fill="${u.upS}"/></g><path d="${clip}" ${OL}/>`;
    },
    target: (h) => ({ chk: h ? 1 : 0 }),
    draw(p, E) {
      const L = 9.8;
      at(E.chk, { 'stroke-dasharray': L, 'stroke-dashoffset': f(L * (1 - Math.max(0, Math.min(1, p.chk)))) });
    }
  },
  {
    name: '复制',
    // Two sheets; the copy slides out from the original on hover.
    svg: (u) => {
      const sheet = rr(0, 0, 13.6, 15.6, KR);
      return `<g data-n="b"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${sheet}" fill="${u.loS}"/></g></g><path d="${sheet}" ${OL}/></g>
        <g data-n="fr"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${sheet}" fill="${u.up(15.6)}"/></g></g><path d="${sheet}" ${OL}/>
          <path d="${lines(2.6, 4.2, [8.4, 5.6])}" class="ln" ${DEEPS} stroke-opacity=".55"/></g>`;
    },
    target: (h) => ({ b: h ? [4.6, 1.6] : [5.2, 2.2], fr: h ? [12.8, 7.8] : [12.2, 7.2] }),
    draw(p, E) {
      at(E.b, { transform: `translate(${f(p.b[0])} ${f(p.b[1])})` });
      at(E.fr, { transform: `translate(${f(p.fr[0])} ${f(p.fr[1])})` });
    }
  },
  {
    name: '灯泡',
    // A bulb that lights up on hover.
    svg: (u) => {
      const glass = 'M11 15.6C8.8 14 7.4 11.6 7.4 9A8.1 8.1 0 0 1 23.6 9C23.6 11.6 22.2 14 20 15.6V17.6H11Z';
      const base = rr(10.8, 16.8, 9.4, 6.4, 2);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${glass}" fill="${u.upS}"/></g></g><path d="${glass}" ${OL}/>
        <circle data-n="glow" cx="15.5" cy="9.4" r="5" fill="#fff"/>
        <path d="M12.8 12.6L14.2 9.8L15.5 11.8L16.8 9.8L18.2 12.6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${DEEPS}/>
        <g filter="${u.hi}"><path d="${base}" fill="${u.loS}"/></g><path d="${base}" ${OL}/>
        <path d="${lines(12.8, 20, [5.4])}" class="ln" stroke="#fff" data-w="stroke"/>`;
    },
    target: (h) => ({ glow: h ? 0.85 : 0 }),
    draw(p, E) { at(E.glow, { opacity: f(p.glow) }); }
  },
  {
    name: '盾牌',
    // A shield with a lit half; it steps forward on hover.
    svg: (u) => {
      const sh = 'M15.5 1.4L24.2 4.8V11.4C24.2 17.2 20.6 21.6 15.5 23.8C10.4 21.6 6.8 17.2 6.8 11.4V4.8Z';
      return `<g data-n="g">
        <clipPath id="${u.id('half')}"><rect x="15.5" y="-2" width="16" height="30"/></clipPath>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${sh}" fill="${u.loS}"/></g></g>
        <g clip-path="url(#${u.id('half')})"><g filter="${u.hi}"><path d="${sh}" fill="${u.upS}"/></g></g>
        <path d="${sh}" ${OL}/>
        <path d="M11.4 12.2L14.4 15.2L19.8 9.6" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" ${DEEPS}/>
      </g>`;
    },
    target: (h) => ({ y: h ? -1 : 0, s: h ? 1.06 : 1 }),
    draw(p, E) { at(E.g, { transform: `translate(15.5 ${f(12.6 + p.y)}) scale(${f(p.s)}) translate(-15.5 -12.6)` }); }
  },
  {
    name: '眼睛',
    // An eye that glances to the side on hover.
    svg: (u) => {
      const eye = 'M3.6 12.5C7 6.6 11 4.2 15.5 4.2C20 4.2 24 6.6 27.4 12.5C24 18.4 20 20.8 15.5 20.8C11 20.8 7 18.4 3.6 12.5Z';
      return `<clipPath id="${u.id('eye')}"><path d="${eye}"/></clipPath>
        <g filter="${u.sh}"><g filter="${u.hi}"><path d="${eye}" fill="${u.loS}"/></g></g>
        <g clip-path="url(#${u.id('eye')})"><g data-n="iris"><g filter="${u.hi}"><path d="${circ(0, 0, 5.4)}" fill="${u.upS}"/></g><path d="${circ(0, 0, 5.4)}" ${OL}/>
          <circle data-n="pup" ${DEEP}/></g></g>
        <path d="${eye}" ${OL}/>`;
    },
    target: (h) => ({ x: h ? 2.6 : 0, pup: h ? 2.9 : 2.3 }),
    draw(p, E) { at(E.iris, { transform: `translate(${f(15.5 + p.x)} 12.5)` }); at(E.pup, { r: f(p.pup) }); }
  },
  {
    name: '图表',
    // A bar chart whose bars rise and fall to new values on hover.
    svg: (u) => `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${rr(5.2, 2.2, 20.6, 20.6, KR)}" fill="${u.loS}"/></g></g>
      <path d="${rr(5.2, 2.2, 20.6, 20.6, KR)}" ${OL}/>
      <path data-n="b1" fill="#fff"/><path data-n="b2" fill="#fff"/><path data-n="b3" fill="#fff"/>`,
    target: (h) => ({ hgt: h ? [10, 5.4, 13.4] : [5.4, 10.6, 7.6] }),
    draw(p, E) {
      [8.4, 13.7, 19].forEach((x, i) => {
        const hh = p.hgt[i];
        at(E['b' + (i + 1)], { d: rp(R(x, 20 - hh, 3.6, hh), [1, 1, 0.4, 0.4]) });
      });
    }
  },
  {
    name: '文档',
    // A page whose folded corner opens a little more on hover.
    svg: (u) => `<g filter="${u.sh}"><g filter="${u.hi}"><path data-n="pg" fill="${u.loS}"/></g></g><path data-n="pgO" ${OL}/>
      <path d="${lines(9.6, 13.4, [11.8, 8.2])}" class="ln" stroke="#fff" data-w="stroke"/>
      <g filter="${u.hi}"><path data-n="fold" fill="${u.upS}"/></g><path data-n="foldO" ${OL}/>`,
    target: (h) => ({ fold: h ? 8 : 6 }),
    draw(p, E) {
      const c = p.fold;
      const pg = rp([[6.3, 1.5], [24.7 - c, 1.5], [24.7, 1.5 + c], [24.7, 23.5], [6.3, 23.5]], [KR, 0.5, 0.5, KR, KR]);
      const fold = rp([[24.7 - c, 1.5], [24.7, 1.5 + c], [24.7 - c, 1.5 + c]], [0.4, 0.4, 1.2]);
      at(E.pg, { d: pg }); at(E.pgO, { d: pg }); at(E.fold, { d: fold }); at(E.foldO, { d: fold });
    }
  },
  {
    name: '标签',
    // A hanging tag that swings on hover.
    svg: (u) => {
      const tag = rp([[4.4, 12.5], [11, 5.2], [26, 5.2], [26, 19.8], [11, 19.8]], [1.6, 1.6, KR, KR, 1.6]);
      return `<g filter="${u.sh}"><g filter="${u.hi}"><g data-n="t"><path d="${tag}" fill="${u.loS}"/><circle cx="11.6" cy="12.5" r="2.2" fill="#fff"/></g></g></g>
        <g data-n="tO"><path d="${tag}" ${OL}/></g>`;
    },
    target: (h) => ({ a: h ? -22 : -34 }),
    draw(p, E) {
      const t = `rotate(${f(p.a)} 15.5 12.5)`;
      at(E.t, { transform: t }); at(E.tO, { transform: t });
    }
  },
  {
    name: '分享',
    // Three connected nodes; the shared ones spread out on hover.
    svg: (u) => `<path data-n="ln" fill="none" stroke-width="2.2" stroke-linecap="round" ${DEEPS}/>
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(9.4, 12.5, 4.4)}" fill="${u.loS}"/></g></g><path d="${circ(9.4, 12.5, 4.4)}" ${OL}/>
      <g data-n="n1"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(0, 0, 4)}" fill="${u.upS}"/></g></g><path d="${circ(0, 0, 4)}" ${OL}/></g>
      <g data-n="n2"><g filter="${u.sh}"><g filter="${u.hi}"><path d="${circ(0, 0, 4)}" fill="${u.upS}"/></g></g><path d="${circ(0, 0, 4)}" ${OL}/></g>`,
    target: (h) => ({ d: h ? 1.2 : 0 }),
    draw(p, E) {
      const a = [21.8 + p.d, 6.4 - p.d * 0.6], b = [21.8 + p.d, 18.6 + p.d * 0.6];
      at(E.n1, { transform: `translate(${f(a[0])} ${f(a[1])})` });
      at(E.n2, { transform: `translate(${f(b[0])} ${f(b[1])})` });
      at(E.ln, { d: `M9.4 12.5L${f(a[0])} ${f(a[1])}M9.4 12.5L${f(b[0])} ${f(b[1])}` });
    }
  },
  {
    name: '书本',
    // A closed book whose cover swings open on hover.
    svg: (u) => {
      const back = rr(6.3, 1.5, 18.4, 22, KR), cover = rr(6.3, 1.5, 18.4, 19.4, KR);
      return `<g filter="${u.sh}"><path d="${back}" fill="${u.loS}"/></g><path d="${back}" ${OL}/>
        <path d="${rr(7.8, 3, 15.6, 19.4, CR)}" fill="#fff"/>
        <path d="${lines(11.4, 8.4, [9.2, 6.6])}" ${ACC}/>
        <g data-n="cv"><g filter="${u.hi}"><path d="${cover}" fill="${u.loS}"/></g><path data-n="sh" d="${cover}" ${DEEP} opacity="0"/><path d="${cover}" ${OL}/>
          <path d="${lines(10.4, 7.6, [10.2])}" class="ln" stroke="#fff" data-w="stroke"/></g>`;
    },
    target: (h) => ({ o: h ? 1 : 0 }),
    draw(p, E) {
      const o = Math.max(0, Math.min(1, p.o));
      at(E.cv, { transform: `translate(6.3 0) scale(${f(Math.max(0.001, 1 - 0.72 * o))} 1) translate(-6.3 0)` });
      at(E.sh, { opacity: f(0.35 * o) });
    }
  },
  {
    name: '笔记本',
    // A spiral notebook. On hover the cover turns over on its rings and folds away behind,
    // leaving the lined first page.
    svg: (u) => {
      const back = rr(6.3, 1, 18.4, 23, KR);
      const rings = [5.5, 10.2, 14.8, 19.5].map((y) => rr(3.8, y - 1.2, 7.4, 2.4, 1.2)).join('');
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${back}" fill="${u.loS}"/></g></g>
      <path d="${back}" ${OL}/>
      <path d="${rr(9.4, 3, 13.3, 19, CR)}" fill="#fff"/>
      <path d="${lines(13.4, 8.4, [7.4, 5])}" ${ACC}/>
      <g data-n="cvG"><g filter="${u.hi}"><path data-n="cv" fill="${u.upS}"/></g>
        <path data-n="shade" ${DEEP} opacity="0"/>
        <path data-n="cvO" ${OL}/>
        <g data-n="label"><path d="${lines(13.4, 7.4, [7])}" class="ln" ${DEEPS} stroke-opacity=".55"/></g></g>
      <path d="${rings}" ${DEEP}/>`;
    },
    target: (h) => ({ o: h ? 1 : 0 }),
    draw(p, E) {
      // The cover's width shrinks to its hinge on the rings, darkening as it faces away; at
      // the end it has gone round behind the back.
      const o = Math.max(0, Math.min(1, p.o));
      const s = Math.cos(o * Math.PI / 2), w = 15.3 * s;
      const d = rp(R(9.4, 1, w, 23), [1.6, KR, KR, 1.6]);
      at(E.cv, { d }); at(E.cvO, { d }); at(E.shade, { d, opacity: f(0.4 * Math.sin(o * Math.PI / 2)) });
      at(E.label, { transform: `translate(9.4 0) scale(${f(Math.max(0.001, s))} 1) translate(-9.4 0)` });
      at(E.cvG, { opacity: o > 0.985 ? 0 : 1 });
    }
  },
  {
    name: '计算器',
    // A calculator with a display and four operator keys. On hover the equals key is
    // pressed, lights up, and the display fills with the result.
    svg: (u) => {
      const body = rr(6.3, 1, 18.4, 23, KR), eq = rr(16.5, 16.8, 6.2, 5.2, CR);
      const eqMark = 'M18.3 18.1H20.9M18.3 20.7H20.9';
      return `
      <g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g>
      <path d="${body}" ${OL}/>
      <path d="${rr(8.3, 3, 14.4, 4.6, CR)}" fill="#fff"/>
      <path data-n="read" class="ln" ${DEEPS}/>
      <path d="${rr(8.3, 9.6, 6.2, 5.2, CR) + rr(16.5, 9.6, 6.2, 5.2, CR) + rr(8.3, 16.8, 6.2, 5.2, CR)}" fill="#fff"/>
      <path d="M10.1 12.2H12.7M11.4 10.9V13.5M18.3 12.2H20.9M10.4 18.4L12.4 20.4M12.4 18.4L10.4 20.4" class="ln" ${DEEPS}/>
      <g data-n="eq"><path d="${eq}" fill="#fff"/><path data-n="lit" d="${eq}" fill="${u.pure('#2F6FE0')}"/>
        <path data-n="eqD" d="${eqMark}" class="ln" ${DEEPS}/><path data-n="eqW" d="${eqMark}" class="ln" stroke="#fff" data-w="stroke"/></g>`;
    },
    target: (h) => ({ o: h ? 1 : 0, s: h ? 0.9 : 1, n: h ? 9.6 : 3.4 }),
    draw(p, E) {
      const o = Math.max(0, Math.min(1, p.o));
      at(E.eq, { transform: `translate(19.6 19.4) scale(${f(p.s)}) translate(-19.6 -19.4)` });
      at(E.lit, { opacity: f(o) }); at(E.eqW, { opacity: f(o) }); at(E.eqD, { opacity: f(1 - o) });
      at(E.read, { d: `M${f(20.9 - p.n)} 5.3H20.9` });
    }
  }
];

// PrismPress original brand mark: a faceted prism refracting an incoming beam.
ICONS.push({
  name: '棱镜',
  svg(u) {
    const body = rp([[14.8, 1.4], [25.6, 22.8], [4, 22.8]], 1.8);
    const facet = rp([[14.8, 5.4], [23.4, 22.8], [14.8, 22.8]], [0.8, 1.8, 1.2]);
    return `<g filter="${u.sh}"><g filter="${u.hi}"><path d="${body}" fill="${u.loS}"/></g></g>
      <path d="${body}" ${OL}/>
      <g filter="${u.hi}"><path d="${facet}" fill="${u.upS}"/></g>
      <path d="M1.8 14H10.8" stroke-width="2.2" stroke-linecap="round" ${DEEPS}/>
      <path d="M12.5 11.5L17.8 14L12.5 16.5Z" fill="#fff"/>
      <g data-n="rays"><path data-n="top" class="ln" ${DEEPS}/>
      <path d="M22.5 14H29" class="ln" ${DEEPS}/>
      <path data-n="bottom" class="ln" ${DEEPS}/></g>`;
  },
  target: h => ({ spread: h ? 3.4 : 1.6 }),
  draw(p, E) {
    at(E.top, { d: `M22.5 9.6L29 ${f(9.6-p.spread)}` });
    at(E.bottom, { d: `M24 18.4L29 ${f(18.4+p.spread)}` });
  }
});
