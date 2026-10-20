(() => {
  const META = JSON.parse(document.getElementById('meta').textContent);
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- texts ---------------- */
  const T = {
    ar: {
      title: 'كام سعر عربيتك في السوق؟',
      sub: 'اختار الماركة والموديل والسنة والعداد، والنموذج هيقدّرلك السعر بناءً على إعلانات عربيات مستعملة من هتلاقي.',
      brand: 'الماركة', model: 'الموديل', year: 'سنة الصنع', km: 'العداد (كم)', fuel: 'نوع الوقود', trans: 'ناقل الحركة',
      pickBrand: 'اختار الماركة', pickModel: 'اختار الموديل', calc: 'احسب السعر', calculating: 'بيحسب…',
      empty: 'اختار بيانات العربية واضغط «احسب السعر».', unit: 'جنيه مصري',
      rangeTitle: 'المدى المتوقع (80% من الحالات)',
      median: 'متوسط سعر نفس الموديل في البيانات', similar: 'عدد إعلانات الموديل في البيانات',
      above: (p) => `أعلى من المتوسط بحوالي ${p}%`, below: (p) => `أقل من المتوسط بحوالي ${p}%`, near: 'قريب من المتوسط',
      lowconf: 'الموديل ده ليه إعلانات قليلة في البيانات، فالتقدير ممكن يكون بعيد عن السعر الحقيقي.',
      chartTitle: 'السعر لو العداد قرا رقم تاني', chartSub: 'نفس العربية ونفس السنة، والعداد هو اللي بيتغير.',
      modelHint: (n) => `${n} إعلان للموديل ده في البيانات`,
      manual: 'مانيوال', Automatic: 'أوتوماتيك', Manual: 'مانيوال',
      fuels: { Gas: 'بنزين', Diesel: 'سولار', 'Natural Gas': 'غاز طبيعي', Hybrid: 'هايبرد', Electric: 'كهرباء' },
      err: {
        need: 'اختار الماركة والموديل الأول.',
        missing_fields: 'في بيانات ناقصة.', unknown_car: 'الماركة أو الموديل مش موجودين في البيانات.',
        bad_year: 'السنة خارج النطاق المتاح.', bad_km: 'العداد لازم يكون بين 0 و2,000,000 كم.',
        bad_option: 'الوقود أو ناقل الحركة مش متاحين.', no_model: 'النموذج لسه متدرّبش. شغّل train_model.py الأول.',
        server: 'حصلت مشكلة في الحساب، جرّب تاني.',
      },
      foot: (m) => `النموذج XGBoost متدرّب على ${fmt(m.n_rows)} إعلان. متوسط الخطأ المطلق على بيانات الاختبار حوالي ${fmt(m.mae)} جنيه، ومعامل R² = ${m.r2.toFixed(2)}. التقدير استرشادي ومش بديل لفحص العربية.`,
      btn: 'English',
    },
    en: {
      title: "What's your car worth on the Egyptian market?",
      sub: 'Pick the brand, model, year and odometer. The model estimates a price from used-car listings scraped from Hatla2ee.',
      brand: 'Brand', model: 'Model', year: 'Year', km: 'Odometer (km)', fuel: 'Fuel', trans: 'Transmission',
      pickBrand: 'Choose a brand', pickModel: 'Choose a model', calc: 'Estimate price', calculating: 'Calculating…',
      empty: 'Enter the car details and press “Estimate price”.', unit: 'Egyptian pounds',
      rangeTitle: 'Expected range (80% of cases)',
      median: 'Median price of this model in the data', similar: 'Listings of this model in the data',
      above: (p) => `About ${p}% above the median`, below: (p) => `About ${p}% below the median`, near: 'Close to the median',
      lowconf: 'This model has very few listings in the data, so the estimate may be far from the real price.',
      chartTitle: 'Price if the odometer read differently', chartSub: 'Same car, same year; only the odometer changes.',
      modelHint: (n) => `${n} listings of this model in the data`,
      Automatic: 'Automatic', Manual: 'Manual',
      fuels: { Gas: 'Petrol', Diesel: 'Diesel', 'Natural Gas': 'Natural gas', Hybrid: 'Hybrid', Electric: 'Electric' },
      err: {
        need: 'Choose a brand and a model first.',
        missing_fields: 'Some fields are missing.', unknown_car: 'That brand or model is not in the data.',
        bad_year: 'Year is outside the available range.', bad_km: 'Odometer must be between 0 and 2,000,000 km.',
        bad_option: 'Fuel or transmission not available.', no_model: 'The model is not trained yet. Run train_model.py first.',
        server: 'Something went wrong. Please try again.',
      },
      foot: (m) => `XGBoost model trained on ${fmt(m.n_rows)} listings. Mean absolute error on held-out data is about EGP ${fmt(m.mae)}, R² = ${m.r2.toFixed(2)}. The estimate is indicative and not a substitute for inspecting the car.`,
      btn: 'العربية',
    },
  };
  let lang = localStorage.getItem('lang') || 'ar';
  const t = () => T[lang];
  const esc = (x) => String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function short(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.round(n / 1e3) + 'K'; }

  /* ---------------- scene extras ---------------- */
  const scene = $('#scene');
  $('#postset').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const x = i * 280;
    return `<rect x="${x}" y="346" width="4" height="42"/><rect x="${x - 14}" y="344" width="22" height="4" rx="2"/>`;
  }).join('');
  $('#dashset').innerHTML = Array.from({ length: 12 }, (_, i) => `<rect x="${i * 140}" y="409" width="70" height="5" rx="2"/>`).join('');

  function boost() {
    if (reduce || !scene.getAnimations) return;
    const anims = scene.getAnimations({ subtree: true });
    const t0 = performance.now();
    scene.classList.add('boost');
    (function step(now) {
      const k = Math.min(1, (now - t0) / 2600);
      const rate = 1 + 5 * Math.pow(1 - k, 2);
      anims.forEach((a) => a.updatePlaybackRate(rate));
      if (k < 1) requestAnimationFrame(step); else scene.classList.remove('boost');
    })(t0);
  }

  /* ---------------- gauge ---------------- */
  const G = { cx: 180, cy: 170, r: 130, a0: -120, a1: 120, pmin: 30000, pmax: 20000000 };
  const pol = (a, r) => { const q = (a * Math.PI) / 180; return [G.cx + r * Math.sin(q), G.cy - r * Math.cos(q)]; };
  const tOf = (p) => Math.min(1, Math.max(0, (Math.log(p) - Math.log(G.pmin)) / (Math.log(G.pmax) - Math.log(G.pmin))));
  const ang = (x) => G.a0 + (G.a1 - G.a0) * x;
  function setNeedle(x) {
    $('#needle').style.transform = `rotate(${ang(x)}deg)`;
    $('#gFill').style.strokeDasharray = `${x * 100} 100`;
  }
  (function buildGauge() {
    const [x0, y0] = pol(G.a0, G.r), [x1, y1] = pol(G.a1, G.r);
    const d = `M${x0} ${y0}A${G.r} ${G.r} 0 1 1 ${x1} ${y1}`;
    $('#gTrack').setAttribute('d', d); $('#gFill').setAttribute('d', d);
    $('#gTicks').innerHTML = [1e5, 2.5e5, 5e5, 1e6, 2.5e6, 5e6, 1e7].map((p) => {
      const a = ang(tOf(p)), [ax, ay] = pol(a, G.r - 14), [bx, by] = pol(a, G.r - 24), [lx, ly] = pol(a, G.r - 38);
      return `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#3B5A66" stroke-width="2"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${short(p)}</text>`;
    }).join('');
    $('#needle').style.transform = `rotate(${G.a0}deg)`;
    // ignition sweep, like a real dashboard on start-up
    if (!reduce) { setTimeout(() => setNeedle(1), 350); setTimeout(() => setNeedle(0), 1500); }
  })();

  let shown = 0;
  const setPrice = (v) => { $('#price').textContent = fmt(v); };
  function countTo(v) {
    if (reduce) { setPrice(v); shown = v; return; }
    const from = shown, t0 = performance.now(), D = 1300;
    (function f(now) {
      const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 4);
      setPrice(from + (v - from) * e);
      if (k < 1) requestAnimationFrame(f); else shown = v;
    })(t0);
  }

  /* ---------------- odometer ---------------- */
  const ODO_N = 7;
  $('#odo').innerHTML = Array.from({ length: ODO_N }, () =>
    `<div class="reel"><div class="strip">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<div>${d}</div>`).join('')}</div></div>`).join('');
  function setOdo(n) {
    const s = String(Math.min(Math.max(0, Math.round(n)), 10 ** ODO_N - 1)).padStart(ODO_N, '0');
    const lead = s.length - String(Math.round(n)).length;
    document.querySelectorAll('#odo .reel').forEach((r, i) => {
      r.querySelector('.strip').style.transform = `translateY(${-s[i] * 44}px)`;
      r.classList.toggle('dim', i < lead);
    });
  }

  /* ---------------- form ---------------- */
  const el = { brand: $('#brand'), model: $('#model'), year: $('#year'), km: $('#km'), kmNum: $('#kmNum') };
  const state = { fuel: META.fuels[0], transmission: META.transmissions[0] };
  let hasResult = false, last = null, timer = null;

  el.year.min = META.year_min; el.year.max = META.year_max;
  el.year.value = Math.max(META.year_min, META.year_max - 6);
  el.km.min = 0; el.km.max = META.km_max; el.km.value = 100000; el.kmNum.value = 100000;
  const syncYear = () => { $('#yearVal').textContent = el.year.value; };
  syncYear(); setOdo(100000);

  function fillBrands() {
    const cur = el.brand.value;
    el.brand.innerHTML = `<option value="" disabled ${cur ? '' : 'selected'}>${t().pickBrand}</option>` +
      META.brands.map((b) => `<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
    el.brand.value = cur;
  }
  function fillModels() {
    const b = el.brand.value, cur = el.model.value;
    el.model.disabled = !b;
    el.model.innerHTML = `<option value="" disabled ${cur ? '' : 'selected'}>${t().pickModel}</option>` +
      (META.models[b] || []).map((m) => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');
    el.model.value = cur;
    hint();
  }
  function hint() {
    const s = META.stats[`${el.brand.value}|${el.model.value}`];
    $('#modelHint').textContent = s ? t().modelHint(fmt(s.n)) : '';
  }
  function segment(host, name, values, labelOf, key) {
    host.innerHTML = values.map((v, i) =>
      `<input type="radio" name="${name}" id="${name}${i}" value="${v}" ${state[key] === v ? 'checked' : ''}><label for="${name}${i}">${labelOf(v)}</label>`).join('');
  }
  function fillSegments() {
    segment($('#fuels'), 'fuel', META.fuels, (v) => t().fuels[v] || v, 'fuel');
    segment($('#trans'), 'trans', META.transmissions, (v) => t()[v] || v, 'transmission');
  }
  $('#fuels').addEventListener('change', (e) => { state.fuel = e.target.value; schedule(); });
  $('#trans').addEventListener('change', (e) => { state.transmission = e.target.value; schedule(); });

  el.brand.addEventListener('change', () => { el.model.value = ''; fillModels(); showErr(null); });
  el.model.addEventListener('change', () => { hint(); showErr(null); schedule(); });
  el.year.addEventListener('input', () => { syncYear(); schedule(); });
  el.km.addEventListener('input', () => { el.kmNum.value = el.km.value; setOdo(+el.km.value); schedule(); });
  el.kmNum.addEventListener('input', () => {
    const v = Math.max(0, +el.kmNum.value || 0);
    el.km.value = Math.min(v, META.km_max); setOdo(v); schedule();
  });

  function showErr(code) {
    const box = $('#err');
    box.hidden = !code;
    if (code) box.textContent = t().err[code] || t().err.server;
  }
  function loading(on) {
    const b = $('#go'); b.disabled = on; b.classList.toggle('loading', on);
    $('#goTxt').textContent = on ? t().calculating : t().calc;
  }
  function schedule() { // after the first result, re-estimate live while the user changes inputs
    if (!hasResult) return;
    clearTimeout(timer); timer = setTimeout(calc, 400);
  }

  $('#form').addEventListener('submit', (e) => { e.preventDefault(); calc(true); });

  async function calc(fromButton) {
    if (!el.brand.value || !el.model.value) { showErr('need'); return; }
    showErr(null); loading(true);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: el.brand.value, model: el.model.value, year: +el.year.value,
          km: Math.round(+el.kmNum.value || 0), fuel: state.fuel, transmission: state.transmission,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw j;
      last = j; hasResult = true;
      render(j, true);
      if (fromButton === true) boost();
    } catch (e) {
      showErr((e && e.error) || 'server');
    } finally { loading(false); }
  }

  /* ---------------- result ---------------- */
  function render(r, animate) {
    $('#cluster').classList.remove('is-empty');
    const x = tOf(r.price);
    setNeedle(x);
    if (animate) countTo(r.price); else { setPrice(r.price); shown = r.price; }

    $('#lo').textContent = fmt(r.low); $('#hi').textContent = fmt(r.high);
    const pos = r.high > r.low ? Math.min(1, Math.max(0, (r.price - r.low) / (r.high - r.low))) : 0.5;
    $('#mark').style.left = `${20 + 60 * pos}%`;

    $('#med').textContent = r.median_price ? `${fmt(r.median_price)}` : '—';
    const p = r.vs_median_pct;
    $('#vs').textContent = p == null ? '' : Math.abs(p) < 3 ? t().near : p > 0 ? t().above(p) : t().below(-p);
    $('#nList').textContent = fmt(r.n_listings);
    $('#note').hidden = !r.low_confidence;
    drawChart(r);
  }

  function drawChart(r) {
    const W = 420, H = 170, L = 8, R = 8, Tp = 12, B = 30;
    const ks = r.curve.map((c) => c.km), ps = r.curve.map((c) => c.price);
    const x0 = Math.min(...ks), x1 = Math.max(...ks);
    const lo = Math.min(...ps), hi = Math.max(...ps), span = hi - lo || 1;
    const X = (k) => L + ((k - x0) / (x1 - x0 || 1)) * (W - L - R);
    const Y = (p) => Tp + (1 - (p - lo) / span) * (H - Tp - B);
    const d = r.curve.map((c, i) => `${i ? 'L' : 'M'}${X(c.km).toFixed(1)} ${Y(c.price).toFixed(1)}`).join('');
    const area = `${d}L${X(x1)} ${H - B}L${X(x0)} ${H - B}Z`;
    const cx = X(+$('#kmNum').value || 0), cy = Y(r.price);
    $('#chart').innerHTML = `
      <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2A33A" stop-opacity=".28"/><stop offset="1" stop-color="#F2A33A" stop-opacity="0"/></linearGradient></defs>
      <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#28424D"/>
      <path class="area" d="${area}"/>
      <path class="line" id="ln" d="${d}"/>
      <circle class="dot" cx="${cx}" cy="${cy}" r="5.5"/>
      <text x="${L}" y="${H - 10}">${short(x0)} km</text>
      <text x="${W - R}" y="${H - 10}" text-anchor="end">${short(x1)} km</text>
      <text x="${L}" y="${Tp - 2}">${fmt(hi)}</text>
      <text x="${W - R}" y="${H - B - 6}" text-anchor="end">${fmt(lo)}</text>`;
    const ln = $('#ln');
    if (!reduce && ln.getTotalLength) {
      const len = ln.getTotalLength();
      ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len;
      ln.getBoundingClientRect(); // force reflow so the transition starts from the hidden state
      ln.style.transition = 'stroke-dashoffset 1.2s ease-out'; ln.style.strokeDashoffset = 0;
    }
  }

  /* ---------------- language ---------------- */
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? 'سعر عربيتك المستعملة' : 'Used car price estimator';
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t()[n.dataset.i18n]; });
    $('#lang').textContent = t().btn;
    $('#foot').textContent = t().foot(META.metrics);
    fillBrands(); fillModels(); fillSegments();
    if (!$('#go').disabled) $('#goTxt').textContent = t().calc;
    if (last) render(last, false);
  }
  $('#lang').addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('lang', lang); applyLang();
  });

  applyLang();
})();
