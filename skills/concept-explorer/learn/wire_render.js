const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KL = {public:'PUBLIC',secret:'SECRET',onetime:'ONE-TIME',signed:'SIGNED',spring:'SET BY SPRING',internal:'PROVIDER-INTERNAL',info:'INFO'};
let cur = {f:0, h:0};

function allText(H){ return ['req','res','dec','fail'].map(k => H[k] ? H[k].raw : '').join('\n'); }
function valOf(t){
  let v = t; const i = t.indexOf('='), j = t.indexOf(': ');
  if (i > 0 && (j < 0 || i < j)) v = t.slice(i + 1); else if (j > 0) v = t.slice(j + 2);
  return v.replace(/^["'\[{(\s]+|["'\]}),\s]+$/g, '');
}
function fromHop(F, hi, t){
  const v = valOf(t); if (v.length < 5) return 0;
  for (let k = hi - 1; k >= 0; k--) if (allText(F.hops[k]).includes(v)) return k + 1;
  return 0;
}
function tokenize(raw, parts, pid, F, hi){
  let out = '', pos = 0; const marks = [];
  parts.forEach((p, i) => { const at = raw.indexOf(p[0], pos); if (at >= 0){ marks.push([at, at + p[0].length, i]); pos = at + p[0].length; } });
  pos = 0;
  marks.forEach(([a, b, i]) => {
    const fh = fromHop(F, hi, parts[i][0]);
    out += esc(raw.slice(pos, a)) + `<span class="tk ${parts[i][3]} ${fh ? 'carried' : 'new'}" data-p="${pid}-${i}">` + esc(raw.slice(a, b)) + '</span>'; pos = b; });
  return out + esc(raw.slice(pos));
}
function block(title, b, pid, F, hi){
  if (!b) return '';
  const rows = b.parts.map((p, i) => { const fh = fromHop(F, hi, p[0]);
    const ch = fh ? `<span class="kd carried">FROM HOP ${fh}</span>` : `<span class="kd newk">NEW</span>`;
    return `<li class="pt" data-p="${pid}-${i}"><div><div class="nm">${esc(p[1])}</div><span class="kd ${p[3]}">${KL[p[3]]}</span> ${ch}</div><div class="mn">${p[2]}</div></li>`; }).join('');
  return `<h3>${title}</h3><pre class="raw">${tokenize(b.raw, b.parts, pid, F, hi)}</pre>${rows ? '<ul class="parts">' + rows + '</ul>' : ''}`;
}
function changed(F, hi){
  const H = F.hops[hi], nw = [], cr = [];
  ['req','res','dec','fail'].forEach(k => { if (!H[k]) return; H[k].parts.forEach(p => { const fh = fromHop(F, hi, p[0]); (fh ? cr : nw).push(fh ? `${esc(p[1])} <span class="faint">(hop ${fh})</span>` : esc(p[1])); }); });
  if (hi === 0) return `<div class="box chg"><b>Start of the flow.</b> Everything here is new.</div>`;
  return `<div class="box chg"><b>What changed since hop ${hi}:</b>
    ${nw.length ? `<div><span class="kd newk">NEW</span> ${nw.join(' · ')}</div>` : ''}
    ${cr.length ? `<div><span class="kd carried">CARRIED</span> ${cr.join(' · ')}</div>` : ''}</div>`;
}
function formula(H){
  if (!H.f) return '';
  const rows = ['who','where','carries','checks','returns'].map(k => `<div class="fr" title="${esc(FORMULA_HELP[k])}"><span class="fk">${k.toUpperCase()}</span><span class="fv">${esc(H.f[k])}</span></div>`).join('');
  return `<div class="formula"><div class="fh">Say it in the interview</div>${rows}</div>`;
}
function renderControls(){
  const own = location.hash === '#own';
  const groups = [...new Set(FLOWS.map(F => F.g))];
  $('#flowSel').innerHTML = groups.map(g => `<optgroup label="${esc(g)}">` + FLOWS.map((F, i) => F.g === g ? `<option value="${i}" ${!own && i === cur.f ? 'selected' : ''}>${esc(F.name)}</option>` : '').join('') + '</optgroup>').join('') + `<option value="own" ${own ? 'selected' : ''}>✎ Dissect your own</option>`;
  const F = FLOWS[cur.f];
  $('#hopNo').textContent = own ? '' : `Hop ${cur.h + 1}/${F.hops.length}`;
  $('#tprev').disabled = own || (cur.f === 0 && cur.h === 0);
  $('#tnext').disabled = own || (cur.f === FLOWS.length - 1 && cur.h === F.hops.length - 1);
  $('#tnext').textContent = !own && cur.h === F.hops.length - 1 ? 'Next flow →' : 'Next →';
}
function step(d){
  const F = FLOWS[cur.f];
  if (d > 0){ if (cur.h < F.hops.length - 1) cur.h++; else if (cur.f < FLOWS.length - 1){ cur.f++; cur.h = 0; } }
  else { if (cur.h > 0) cur.h--; else if (cur.f > 0){ cur.f--; cur.h = FLOWS[cur.f].hops.length - 1; } }
  go(); const fv = $('#flowView'), top = document.querySelector('.top'); window.scrollTo({top: Math.max(0, fv.getBoundingClientRect().top + window.scrollY - top.offsetHeight - 8)});
}
function renderFlow(){
  const F = FLOWS[cur.f], H = F.hops[cur.h], hi = cur.h;
  const lanes = F.actors.map(a => { const c = a === H.from ? 'from' : (a === H.to ? 'to' : ''); return `<span class="lane ${c}">${esc(a)}</span>`; }).join('');
  const chips = F.hops.map((h, i) => `<button class="chip ${i === hi ? 'on' : ''}" data-h="${i}" title="${esc(h.title)}">${i + 1}</button>`).join('');
  const chName = {front:'front channel', back:'back channel (server → server)', jvm:'inside the JVM', user:'user ↔ server'}[H.ch];
  const links = F.links.map(l => `<a class="go" href="index.html#${l[0]}/${l[1]}/1">▶ ${esc(l[2])}</a>`).join('');
  const same = H.from === H.to;
  $('#flowView').innerHTML = `
   <div class="area">${esc(F.g)}</div>
   <h2 style="margin:0">${esc(F.name)}</h2>
   <p class="goal">${esc(F.goal)}</p>
   <div class="chips">${chips}</div>
   <div class="lanes">${lanes}</div>
   <h2>Hop ${hi + 1} · ${esc(H.title)} <span class="ch ${H.ch}">${chName}</span></h2>
   <div class="lanes"><span class="lane from">${esc(H.from)}</span>${same ? '' : `<span class="arrow">→</span><span class="lane to">${esc(H.to)}</span>`}</div>
   ${formula(H)}
   ${changed(F, hi)}
   ${block(same ? 'What comes in' : 'Request', H.req, 'q', F, hi)}
   ${block(same ? 'What goes out' : 'Response', H.res, 'r', F, hi)}
   ${H.dec ? block(H.dec.title, H.dec, 'd', F, hi) : ''}
   ${H.fail ? block('When it fails', H.fail, 'x', F, hi) : ''}
   <div class="box"><b>Carries to the next hop:</b> ${H.next}</div>
   <div class="meta"><div class="box"><b>Spring class:</b> ${H.spring}</div><div class="box"><b>Your config / code:</b> ${H.config}</div></div>
   <div class="nav"><button class="btn" id="prev">← Back</button><button class="btn primary" id="next">${hi === F.hops.length - 1 ? 'Next flow →' : 'Next hop →'}</button></div>
   <div class="links">${links}</div>`;
  $('#prev').disabled = cur.f === 0 && hi === 0;
  $('#next').disabled = cur.f === FLOWS.length - 1 && hi === F.hops.length - 1;
  $('#prev').onclick = () => step(-1);
  $('#next').onclick = () => step(1);
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { cur.h = +c.dataset.h; go(); });
}
function go(){ location.hash = FLOWS[cur.f].id + '/' + (cur.h + 1); }
function route(){
  const h = location.hash.slice(1);
  if (h === 'own'){ $('#flowView').classList.add('hidden'); $('#own').classList.remove('hidden'); renderControls(); return; }
  const [fid, hn] = h.split('/'); const fi = FLOWS.findIndex(F => F.id === fid);
  if (fi >= 0){ cur.f = fi; cur.h = Math.min(Math.max((+hn || 1) - 1, 0), FLOWS[fi].hops.length - 1); }
  $('#own').classList.add('hidden'); $('#flowView').classList.remove('hidden');
  renderControls(); renderFlow();
}
$('#flowSel').onchange = e => { if (e.target.value === 'own') location.hash = 'own'; else { cur = {f:+e.target.value, h:0}; go(); } };
$('#tprev').onclick = () => step(-1);
$('#tnext').onclick = () => step(1);
document.addEventListener('keydown', e => { if (e.target.closest('textarea,select,input')) return; if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
document.addEventListener('click', e => {
  const fr = e.target.closest('.fr'); if (fr && document.body.classList.contains('practice')) fr.classList.toggle('open');
  const t = e.target.closest('[data-p]'); if (!t) return;
  const id = t.dataset.p;
  if (t.classList.contains('pt') && document.body.classList.contains('practice')) t.classList.toggle('open');
  document.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  document.querySelectorAll(`[data-p="${id}"]`).forEach(x => x.classList.add('hl'));
  if (t.classList.contains('tk')){ const row = document.querySelector(`.pt[data-p="${id}"]`); if (row) row.scrollIntoView({block:'nearest', behavior:'smooth'}); }
});
$('#practice').onchange = e => { document.body.classList.toggle('practice', e.target.checked); document.querySelectorAll('.pt.open,.fr.open').forEach(x => x.classList.remove('open')); };

