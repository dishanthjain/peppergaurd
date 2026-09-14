(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const round = (n, p = 1) => Number(n.toFixed(p));
  const nowISO = () => new Date().toISOString();
  const daysBetween = date => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  const formatTime = iso => new Intl.DateTimeFormat('en-IN', {hour:'2-digit', minute:'2-digit'}).format(new Date(iso));
  const formatDate = iso => new Intl.DateTimeFormat('en-IN', {day:'2-digit', month:'short', year:'numeric'}).format(new Date(iso));
  const scenarioTargets = { normal:{h:63,t:24.5}, rising:{h:78,t:26.8}, critical:{h:88,t:30.2} };
  const recommendations = {
    WARNING:'Increase ventilation and inspect for moisture pockets.',
    HIGH:'Inspect the batch, improve airflow, and separate damp sacks if found.',
    CRITICAL:'Isolate affected sacks and arrange laboratory testing if contamination is suspected.'
  };

  function scoreRisk(batch) {
    const humidity = batch.humidity;
    const temp = batch.temperature;
    const history = batch.history || [];
    const recent = history.slice(-6);
    const prior = history.slice(-12, -6);
    const recentAvg = recent.length ? recent.reduce((s,r)=>s+r.humidity,0)/recent.length : humidity;
    const priorAvg = prior.length ? prior.reduce((s,r)=>s+r.humidity,0)/prior.length : recentAvg;
    const trend = recentAvg - priorAvg;
    const duration = daysBetween(batch.dateStored);
    let humidityPoints = humidity <= 60 ? 4 : humidity <= 70 ? 4 + (humidity-60)*1.4 : humidity <= 80 ? 18 + (humidity-70)*2.2 : 40 + (humidity-80)*1.25;
    humidityPoints = clamp(humidityPoints, 0, 50);
    let tempPoints = temp <= 20 ? 3 : temp <= 27 ? 3 + (temp-20)*.8 : temp <= 32 ? 8.6 + (temp-27)*2.1 : 20;
    tempPoints = clamp(tempPoints, 0, 20);
    const trendPoints = clamp(Math.max(0, trend) * 3, 0, 15);
    const durationPoints = duration < 30 ? 2 : duration < 60 ? 6 : duration < 120 ? 10 : 15;
    const score = Math.round(clamp(humidityPoints + tempPoints + trendPoints + durationPoints, 0, 100));
    const status = score <= 30 ? 'SAFE' : score <= 60 ? 'WARNING' : score <= 80 ? 'HIGH' : 'CRITICAL';
    const reasons = [];
    if (humidity >= 80) reasons.push(`Humidity is critically elevated at ${humidity.toFixed(1)}%.`);
    else if (humidity >= 70) reasons.push(`Humidity is above the configured safe range at ${humidity.toFixed(1)}%.`);
    else reasons.push(`Humidity is within the configured range at ${humidity.toFixed(1)}%.`);
    if (trend > 1) reasons.push(`Humidity rose ${trend.toFixed(1)} points across recent readings.`);
    if (temp > 27) reasons.push(`Temperature is above the 27°C attention threshold.`);
    if (duration >= 120) reasons.push(`Storage duration is ${duration} days, increasing cumulative exposure.`);
    return { score, status, reasons, components:{humidity:round(humidityPoints),temperature:round(tempPoints),trend:round(trendPoints),duration:durationPoints} };
  }

  function seedHistory(baseH, baseT, slope = 0) {
    const arr = [];
    for (let i=23;i>=0;i--) {
      const wave = Math.sin((23-i)/3)*1.2;
      const humidity = round(baseH - slope*i + wave + Math.sin(i*1.8)*.5);
      const temperature = round(baseT + Math.cos(i/3)*.7 + Math.sin(i)*.2);
      arr.push({time:new Date(Date.now()-i*3600000).toISOString(),humidity,temperature,risk:0});
    }
    return arr;
  }

  const initialBatches = [
    {id:'B-012',grade:'Malabar Garbled',quantity:1250,location:'Zone A · Rack 04',dateStored:'2026-05-18',humidity:81.8,temperature:28.9,history:seedHistory(76.5,28.1,.22)},
    {id:'B-013',grade:'Tellicherry Extra Bold',quantity:800,location:'Zone B · Rack 01',dateStored:'2026-07-04',humidity:68.2,temperature:25.1,history:seedHistory(66.8,24.7,.05)},
    {id:'B-014',grade:'Malabar Ungarbled',quantity:640,location:'Zone C · Rack 08',dateStored:'2026-08-11',humidity:61.6,temperature:24.2,history:seedHistory(61.2,24.0,.01)},
    {id:'B-015',grade:'Light Berries',quantity:420,location:'Zone D · Rack 03',dateStored:'2026-06-22',humidity:73.9,temperature:27.4,history:seedHistory(71.1,26.6,.12)}
  ];

  const state = {
    batches: JSON.parse(localStorage.getItem('pepperguard-batches') || 'null') || initialBatches,
    alerts: JSON.parse(localStorage.getItem('pepperguard-alerts') || 'null') || [],
    scenario:'normal', paused:false, selectedAnalytics:'all', tick:0
  };

  function hydrateScores() {
    state.batches.forEach(b => {
      const risk = scoreRisk(b); Object.assign(b, risk);
      b.history.forEach((r, i) => {
        const tempBatch = {...b, humidity:r.humidity, temperature:r.temperature, history:b.history.slice(0,i+1)};
        r.risk = scoreRisk(tempBatch).score;
      });
    });
  }
  hydrateScores();

  function save() {
    localStorage.setItem('pepperguard-batches', JSON.stringify(state.batches));
    localStorage.setItem('pepperguard-alerts', JSON.stringify(state.alerts.slice(0,80)));
  }
  function statusClass(s){return s.toLowerCase();}
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);}

  function maybeCreateAlert(batch, previousStatus) {
    if (batch.status === 'SAFE' || batch.status === previousStatus) return;
    const existing = state.alerts.find(a => !a.resolved && a.batchId === batch.id && a.severity === batch.status);
    if (existing) return;
    const reason = batch.status === 'CRITICAL'
      ? `${batch.id} entered a critical environmental fungal-spoilage risk condition.`
      : batch.status === 'HIGH' ? `${batch.id} entered a high environmental fungal-spoilage risk condition.`
      : `Humidity reached ${batch.humidity.toFixed(1)}% with an increasing risk score.`;
    state.alerts.unshift({id:`A-${Date.now()}-${batch.id}`,severity:batch.status,batchId:batch.id,time:nowISO(),reason,recommendation:recommendations[batch.status],resolved:false});
  }

  function simulate() {
    if (state.paused) return;
    state.tick++;
    const target = scenarioTargets[state.scenario];
    state.batches.forEach((batch, index) => {
      const previousStatus = batch.status;
      const sensitivity = 1 + index*.06;
      const drift = state.scenario === 'normal' ? .08 : state.scenario === 'rising' ? .23 : .38;
      batch.humidity = round(clamp(batch.humidity + (target.h-batch.humidity)*drift*sensitivity + (Math.random()-.5)*.65,42,96));
      batch.temperature = round(clamp(batch.temperature + (target.t-batch.temperature)*.17 + (Math.random()-.5)*.28,17,36));
      const risk = scoreRisk(batch); Object.assign(batch,risk);
      batch.history.push({time:nowISO(),humidity:batch.humidity,temperature:batch.temperature,risk:batch.score});
      if(batch.history.length>48) batch.history.shift();
      maybeCreateAlert(batch,previousStatus);
    });
    save(); renderAll();
    $('#lastUpdated').textContent='Updated just now';
  }

  function renderDashboard() {
    const sorted=[...state.batches].sort((a,b)=>b.score-a.score); const focus=sorted[0];
    const avgH=state.batches.reduce((s,b)=>s+b.humidity,0)/state.batches.length;
    const avgT=state.batches.reduce((s,b)=>s+b.temperature,0)/state.batches.length;
    const active=state.alerts.filter(a=>!a.resolved);
    const overall=focus.status;
    $('#metricHumidity').textContent=`${avgH.toFixed(1)}%`;
    $('#metricTemp').textContent=`${avgT.toFixed(1)}°C`;
    $('#metricRisk').textContent=focus.score;
    $('#riskBatch').textContent=`Highest: ${focus.id}`;
    $('#metricBatches').textContent=state.batches.length;
    $('#activeAlertsMetric').textContent=`${active.length} active alert${active.length===1?'':'s'}`;
    $('#navAlertCount').textContent=active.length;
    $('#overallStatus').textContent=overall;
    $('#statusIcon').textContent=overall==='SAFE'?'✓':'!';
    $('#statusCopy').textContent=overall==='SAFE'?'Storage conditions are within the configured range.':overall==='WARNING'?'One or more batches need closer observation.':'Immediate inspection is recommended for the highest-risk batch.';
    $('#heroStatus').className=`hero-status ${statusClass(overall)}`;
    $('#focusBatchName').textContent=`${focus.id} · ${focus.location.split('·')[0].trim()}`;
    $('#focusBadge').textContent=focus.status;
    $('#focusBadge').className=`status-badge ${statusClass(focus.status)}`;
    $('#gaugeScore').textContent=focus.score;
    $('#gaugeValue').style.strokeDashoffset=220-(220*focus.score/100);
    $('#gaugeValue').style.stroke=focus.score<=30?'var(--green)':focus.score<=60?'var(--amber)':'var(--red)';
    $('#gaugeNeedle').style.transform=`rotate(${-90+focus.score*1.8}deg)`;
    $('#riskReasons').innerHTML=focus.reasons.slice(0,3).map(r=>`<li>${r}</li>`).join('');
    const readings=sorted.slice(0,4).map(b=>`<div class="reading-row"><i class="reading-bullet"></i><div><strong>${b.id} · ${b.location}</strong><small>${formatTime(b.history.at(-1).time)} · ${b.grade}</small></div><div class="reading-values"><b>${b.humidity.toFixed(1)}%</b><br>${b.temperature.toFixed(1)}°C</div></div>`).join('');
    $('#recentReadings').innerHTML=readings;
    $('#dashboardAlerts').innerHTML=active.length?active.slice(0,4).map(a=>`<div class="mini-alert ${statusClass(a.severity)}"><span class="alert-severity">!</span><div><strong>${a.batchId} · ${a.severity}</strong><small>${a.reason}</small></div><small>${formatTime(a.time)}</small></div>`).join(''):'<div class="empty-state">No active alerts. Conditions are stable.</div>';
    drawEnvironmentChart();
  }

  function renderBatches() {
    const q=$('#batchSearch').value.toLowerCase(); const filter=$('#statusFilter').value;
    const rows=state.batches.filter(b=>(filter==='all'||b.status===filter)&&`${b.id} ${b.grade} ${b.location}`.toLowerCase().includes(q));
    $('#batchTableBody').innerHTML=rows.map(b=>`<tr><td><strong>${b.id}</strong></td><td>${b.grade}</td><td>${b.quantity.toLocaleString('en-IN')} kg</td><td>${b.location}</td><td>${formatDate(b.dateStored)}</td><td>${b.humidity.toFixed(1)}%</td><td>${b.temperature.toFixed(1)}°C</td><td><span class="risk-number">${b.score}</span>/100</td><td><span class="status-badge ${statusClass(b.status)}">${b.status}</span></td></tr>`).join('') || '<tr><td colspan="9">No batches match this view.</td></tr>';
  }

  function renderAlerts() {
    const active=state.alerts.filter(a=>!a.resolved); const critical=active.filter(a=>['HIGH','CRITICAL'].includes(a.severity)).length;
    $('#alertSummary').innerHTML=`<div class="summary-card"><span>Unresolved alerts</span><strong>${active.length}</strong></div><div class="summary-card"><span>High / critical</span><strong>${critical}</strong></div><div class="summary-card"><span>Resolved events</span><strong>${state.alerts.filter(a=>a.resolved).length}</strong></div>`;
    $('#alertsPageList').innerHTML=state.alerts.length?state.alerts.map(a=>`<article class="alert-card ${statusClass(a.severity)} ${a.resolved?'resolved':''}"><span class="status-badge ${statusClass(a.severity)}">${a.severity}</span><div><h3>${a.reason}</h3><p>Environmental fungal-spoilage risk prediction for ${a.batchId}.</p><div class="alert-meta"><span>Batch: <b>${a.batchId}</b></span><span>Time: ${formatDate(a.time)}, ${formatTime(a.time)}</span><span>Status: ${a.resolved?'Resolved':'Unresolved'}</span></div><div class="recommendation"><b>Recommended action:</b> ${a.recommendation}</div></div><button class="secondary-button resolve-button" data-id="${a.id}" ${a.resolved?'disabled':''}>${a.resolved?'Resolved':'Mark resolved'}</button></article>`).join(''):'<article class="panel"><h3>No alerts generated yet</h3><p class="body-copy">Choose Rising humidity or Critical conditions to demonstrate alert generation.</p></article>';
    $$('.resolve-button').forEach(btn=>btn.addEventListener('click',()=>{const a=state.alerts.find(x=>x.id===btn.dataset.id);if(a){a.resolved=true;save();renderAll();toast('Alert marked as resolved');}}));
  }

  function renderAnalytics() {
    const select=$('#analyticsBatchSelect');
    const old=state.selectedAnalytics;
    select.innerHTML='<option value="all">All batches (average)</option>'+state.batches.map(b=>`<option value="${b.id}">${b.id} · ${b.grade}</option>`).join('');
    select.value=old;
    const series=getAnalyticsSeries();
    const avgH=series.reduce((s,r)=>s+r.humidity,0)/series.length; const avgT=series.reduce((s,r)=>s+r.temperature,0)/series.length;
    $('#analyticsAvgHumidity').textContent=`${avgH.toFixed(1)}%`;
    $('#analyticsAvgTemp').textContent=`${avgT.toFixed(1)}°C`;
    $('#analyticsPeakRisk').textContent=`${Math.max(...series.map(r=>r.risk))}/100`;
    $('#analyticsHoursHigh').textContent=`${series.filter(r=>r.humidity>75).length} readings`;
    drawSingleChart('humidityChart',series.map(r=>r.humidity),'#3f7faf',50,95,70);
    drawSingleChart('temperatureChart',series.map(r=>r.temperature),'#c47725',16,36,27);
    drawSingleChart('riskChart',series.map(r=>r.risk),'#7765b5',0,100,60);
  }

  function getAnalyticsSeries(){
    if(state.selectedAnalytics!=='all') return state.batches.find(b=>b.id===state.selectedAnalytics).history.slice(-24);
    const max=Math.max(...state.batches.map(b=>b.history.length)); const out=[];
    for(let i=Math.max(0,max-24);i<max;i++){
      const values=state.batches.map(b=>b.history[i]).filter(Boolean);
      out.push({time:values[0]?.time||nowISO(),humidity:values.reduce((s,r)=>s+r.humidity,0)/values.length,temperature:values.reduce((s,r)=>s+r.temperature,0)/values.length,risk:values.reduce((s,r)=>s+r.risk,0)/values.length});
    }
    return out;
  }

  function setupCanvas(canvas){
    const rect=canvas.getBoundingClientRect(); const dpr=Math.min(2,window.devicePixelRatio||1); canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return{ctx,w:rect.width,h:rect.height};
  }
  function css(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim();}
  function grid(ctx,w,h,min,max,suffix=''){
    const left=38,right=12,top=12,bottom=28;ctx.font='11px system-ui';ctx.fillStyle=css('--muted');ctx.strokeStyle=css('--border');ctx.lineWidth=1;
    for(let i=0;i<5;i++){const y=top+(h-top-bottom)*i/4;const v=Math.round(max-(max-min)*i/4);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillText(v+suffix,2,y+4);}
    return{left,right,top,bottom,pw:w-left-right,ph:h-top-bottom};
  }
  function line(ctx,values,color,min,max,g){
    ctx.beginPath();values.forEach((v,i)=>{const x=g.left+g.pw*i/(values.length-1||1);const y=g.top+g.ph*(1-(v-min)/(max-min));i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.stroke();
    const v=values.at(-1),x=g.left+g.pw,y=g.top+g.ph*(1-(v-min)/(max-min));ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
  }
  function xLabels(ctx,w,h,g,count){ctx.fillStyle=css('--muted');ctx.font='10px system-ui';const labels=['24h ago','18h','12h','6h','Now'];labels.forEach((t,i)=>{const x=g.left+g.pw*i/4;ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(t,x,h-7);});ctx.textAlign='left';}
  function drawEnvironmentChart(){
    const c=$('#environmentChart');if(!c.offsetWidth)return;const {ctx,w,h}=setupCanvas(c);ctx.clearRect(0,0,w,h);const series=getAnalyticsSeries();const g=grid(ctx,w,h,45,95,'%');xLabels(ctx,w,h,g,series.length);line(ctx,series.map(r=>r.humidity),'#3f7faf',45,95,g);
    const temps=series.map(r=>45+(r.temperature-16)/(36-16)*50);line(ctx,temps,'#c47725',45,95,g);
  }
  function drawSingleChart(id,values,color,min,max,threshold){
    const c=$('#'+id);if(!c||!c.offsetWidth)return;const{ctx,w,h}=setupCanvas(c);ctx.clearRect(0,0,w,h);const g=grid(ctx,w,h,min,max,id==='humidityChart'?'%':id==='temperatureChart'?'°':'');const y=g.top+g.ph*(1-(threshold-min)/(max-min));ctx.save();ctx.strokeStyle=id==='riskChart'?'#cf5148':'#9aa09a';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(g.left,y);ctx.lineTo(w-g.right,y);ctx.stroke();ctx.restore();line(ctx,values,color,min,max,g);xLabels(ctx,w,h,g,values.length);
  }

  function renderAll(){renderDashboard();renderBatches();renderAlerts();renderAnalytics();}
  function navigate(page){
    $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));$$('.page').forEach(p=>p.classList.remove('active'));$(`#page-${page}`).classList.add('active');
    const titles={dashboard:['Storage intelligence','Overview'],batches:['Inventory monitoring','Storage batches'],alerts:['Response workflow','Alerts'],analytics:['Historical insight','Analytics'],integration:['Hardware readiness','IoT integration']};
    $('#pageEyebrow').textContent=titles[page][0];$('#pageTitle').textContent=titles[page][1];$('#sidebar').classList.remove('open');requestAnimationFrame(()=>{if(page==='dashboard')drawEnvironmentChart();if(page==='analytics')renderAnalytics();});
  }

  function exportCSV(){
    const rows=[['Batch ID','Grade','Quantity kg','Location','Date stored','Humidity %','Temperature C','Risk score','Status'],...state.batches.map(b=>[b.id,b.grade,b.quantity,b.location,b.dateStored,b.humidity,b.temperature,b.score,b.status])];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`pepperguard-batches-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);toast('Batch data exported as CSV');
  }

  $$('.nav-item').forEach(n=>n.addEventListener('click',()=>navigate(n.dataset.page)));
  $$('[data-go]').forEach(n=>n.addEventListener('click',()=>navigate(n.dataset.go)));
  $('#menuButton').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
  $('#scenarioSelect').addEventListener('change',e=>{state.scenario=e.target.value;toast(`${e.target.options[e.target.selectedIndex].text} simulation active`);simulate();});
  $('#pauseButton').addEventListener('click',e=>{state.paused=!state.paused;e.target.textContent=state.paused?'Resume':'Pause';toast(state.paused?'Simulation paused':'Simulation resumed');});
  $('#batchSearch').addEventListener('input',renderBatches);$('#statusFilter').addEventListener('change',renderBatches);
  $('#analyticsBatchSelect').addEventListener('change',e=>{state.selectedAnalytics=e.target.value;renderAnalytics();});
  $('#exportButton').addEventListener('click',exportCSV);
  $('#resolveAllButton').addEventListener('click',()=>{state.alerts.forEach(a=>a.resolved=true);save();renderAll();toast('All alerts resolved');});
  const dialog=$('#batchDialog');
  $('#addBatchButton').addEventListener('click',()=>{const d=new Date();$('#batchForm [name=dateStored]').value=d.toISOString().slice(0,10);dialog.showModal();});
  $('#saveBatchButton').addEventListener('click',e=>{e.preventDefault();const form=$('#batchForm');if(!form.reportValidity())return;const f=new FormData(form);if(state.batches.some(b=>b.id.toLowerCase()===String(f.get('id')).toLowerCase())){toast('Batch ID already exists');return;}const humidity=Number(f.get('humidity'));const b={id:String(f.get('id')).toUpperCase(),grade:f.get('grade'),quantity:Number(f.get('quantity')),location:f.get('location'),dateStored:f.get('dateStored'),humidity,temperature:24.5,history:seedHistory(humidity,24.5,.01)};Object.assign(b,scoreRisk(b));state.batches.push(b);save();dialog.close();form.reset();renderAll();navigate('batches');toast(`${b.id} added to monitoring`);});
  window.addEventListener('resize',()=>{clearTimeout(window.__pgResize);window.__pgResize=setTimeout(()=>{drawEnvironmentChart();renderAnalytics();},120)});

  if(!state.alerts.length){
    const b=state.batches.find(x=>x.id==='B-012');state.alerts=[{id:'A-seed-1',severity:'HIGH',batchId:b.id,time:new Date(Date.now()-18*60000).toISOString(),reason:'Humidity exceeded 75% across recent readings.',recommendation:recommendations.HIGH,resolved:false},{id:'A-seed-2',severity:'WARNING',batchId:'B-015',time:new Date(Date.now()-64*60000).toISOString(),reason:'Humidity is trending above the configured safe range.',recommendation:recommendations.WARNING,resolved:false}];save();
  }
  renderAll();setInterval(simulate,4000);
})();
