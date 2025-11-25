/*
  Fancy Task Manager — script.js
  Day-by-day milestones included below (Day 1 through Day 6)
  - Day 1: Base UI wiring, localStorage persistence, add/toggle/delete tasks
  - Day 2: Timeline slots for daily/weekly/monthly and slot-based filtering
  - Day 3: D3 progress bar (svg) + sample tasks bootstrapping
  - Day 4: Plotly pie and bar charts showing distribution and completion rates
  - Day 5: Jump-to-today, Clear filter, responsive redraw on resize
  - Day 6: Sorting, grouping, and small UX improvements (default midday for date-only tasks)
*/

(function(){
    const STORAGE_KEY = 'fancy_task_dashboard_v2';
    let tasks = load();
    let currentPeriod = 'daily';
    let activeSlot = null;
  
    const dailyList = document.getElementById('daily-tasks');
    const weeklyList = document.getElementById('weekly-tasks');
    const monthlyList = document.getElementById('monthly-tasks');
    const nameInput = document.getElementById('task-name');
    const typeInput = document.getElementById('task-type');
    const dateInput = document.getElementById('task-date');
    const timeInput = document.getElementById('task-time');
    const addBtn = document.getElementById('add-btn');
    const slotsArea = document.getElementById('slotsArea');
    const periodBtns = document.querySelectorAll('.period-btn');
    const clearFilterBtn = document.getElementById('clear-filter');
    const jumpTodayBtn = document.getElementById('jump-today');
  
    function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
    function load(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){console.error(e); return [];} }
    function uid(){ return 't'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
    function isoCombine(dateStr, timeStr){
      if(!dateStr) return null;
      if(timeStr) return new Date(dateStr + 'T' + timeStr);
      return new Date(dateStr + 'T12:00');
    }
  
    addBtn.addEventListener('click', ()=>{
      const name = nameInput.value.trim();
      if(!name) return alert('Enter a task name');
      const type = typeInput.value;
      const dueDate = dateInput.value || null;
      const dueTime = timeInput.value || null;
      const due = isoCombine(dueDate, dueTime);
      const t = { id: uid(), name, type, due: due ? due.toISOString() : null, completed:false, createdAt: Date.now() };
      tasks.unshift(t);
      save();
      nameInput.value=''; dateInput.value=''; timeInput.value='';
      activeSlot = null;
      renderAll();
    });
  
    function toggleComplete(id){
      const t = tasks.find(x=>x.id===id); if(!t) return;
      t.completed = !t.completed;
      save(); renderAll();
    }
    function deleteTask(id){
      if(!confirm('Delete this task?')) return;
      tasks = tasks.filter(x=>x.id!==id);
      save(); renderAll();
    }
  
    function getSlotsForPeriod(period){
      if(period==='daily') return ['Early','Morning','Noon','Afternoon','Evening','Night'];
      if(period==='weekly') return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return ['1-7','8-14','15-21','22-28','29-31'];
    }
  
    function getSlotForTask(task, period){
      if(!task.due) return null;
      const d = new Date(task.due);
      if(period==='daily'){
        const hr = d.getHours();
        if(hr<6) return 'Early';
        if(hr<12) return 'Morning';
        if(hr<14) return 'Noon';
        if(hr<17) return 'Afternoon';
        if(hr<20) return 'Evening';
        return 'Night';
      } else if(period==='weekly'){
        return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      } else {
        const day = d.getDate();
        if(day<=7) return '1-7';
        if(day<=14) return '8-14';
        if(day<=21) return '15-21';
        if(day<=28) return '22-28';
        return '29-31';
      }
    }
  
    function renderSlots(){
      const slots = getSlotsForPeriod(currentPeriod);
      const counts = {};
      slots.forEach(s=>counts[s]=0);
      tasks.filter(t=>t.type===currentPeriod).forEach(t=>{
        const s = getSlotForTask(t, currentPeriod);
        if(s && counts[s]!==undefined) counts[s]++;
      });
  
      slotsArea.innerHTML = '';
      slots.forEach(s=>{
        const el = document.createElement('div');
        el.className = 'slot' + (activeSlot===s ? ' active' : '');
        el.setAttribute('data-slot', s);
        el.innerHTML = `<div style="font-weight:700">${s}</div><div class="muted" style="font-size:12px">${counts[s]||0} tasks</div>`;
        el.onclick = () => {
          if(activeSlot===s) { activeSlot = null; } else { activeSlot = s; }
          renderAll();
        };
        slotsArea.appendChild(el);
      });
    }
  
    function createTaskElement(t){
      const li = document.createElement('li'); li.className='task-item';
      const left = document.createElement('div'); left.className='task-left';
      const name = document.createElement('div'); name.className='task-name'; name.textContent = t.name;
      if(t.completed) name.style.textDecoration='line-through';
      name.onclick = ()=> toggleComplete(t.id);
  
      const meta = document.createElement('div'); meta.className='task-meta';
      const parts = [];
      parts.push(t.type.charAt(0).toUpperCase()+t.type.slice(1));
      if(t.due){
        const d = new Date(t.due);
        parts.push('Due: '+ d.toLocaleString());
      }
      meta.textContent = parts.join(' • ');
  
      left.appendChild(name); left.appendChild(meta);
  
      const right = document.createElement('div'); right.className='task-right';
      const created = document.createElement('small'); created.className='muted'; created.textContent = new Date(t.createdAt).toLocaleDateString();
      const del = document.createElement('button'); del.className='btn-delete'; del.textContent='Delete';
      del.onclick = ()=> deleteTask(t.id);
  
      right.appendChild(created); right.appendChild(del);
  
      li.appendChild(left); li.appendChild(right);
      if(t.completed) li.style.opacity = 0.7;
      return li;
    }
  
    function renderLists(){
      dailyList.innerHTML=''; weeklyList.innerHTML=''; monthlyList.innerHTML='';
  
      const groups = { daily:[], weekly:[], monthly:[] };
      tasks.forEach(t => groups[t.type] && groups[t.type].push(t));
  
      function sortfn(a,b){
        if(a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.createdAt - a.createdAt;
      }
  
      function applyAndAppend(listEl, items, period){
        let filtered = items;
        if(activeSlot && period===currentPeriod){
          filtered = items.filter(t => getSlotForTask(t, period) === activeSlot);
        }
        filtered.sort(sortfn).forEach(t => listEl.appendChild(createTaskElement(t)));
      }
  
      applyAndAppend(dailyList, groups.daily, 'daily');
      applyAndAppend(weeklyList, groups.weekly, 'weekly');
      applyAndAppend(monthlyList, groups.monthly, 'monthly');
    }
  
    function calculateMetrics(){
      const m = { total: tasks.length, completed: tasks.filter(t=>t.completed).length,
                  daily:{total:0,completed:0}, weekly:{total:0,completed:0}, monthly:{total:0,completed:0} };
      tasks.forEach(t=>{
        m[t.type].total++;
        if(t.completed) m[t.type].completed++;
      });
      return m;
    }
  
    function drawD3Progress(m){
      const svg = d3.select('#d3-progress-bar');
      const container = document.getElementById('overall-progress-card');
      const width = Math.max(300, container.clientWidth - 20);
      const height = 48;
      const p = m.total ? (m.completed / m.total) : 0;
      const pct = Math.round(p*100);
  
      svg.attr('viewBox',`0 0 ${width} ${height}`).attr('preserveAspectRatio','xMidYMid meet');
      svg.selectAll('*').remove();
  
      svg.append('rect').attr('x',0).attr('y',0).attr('rx',8).attr('ry',8).attr('width',width).attr('height',height).attr('fill','#3b4752');
      svg.append('rect').attr('x',0).attr('y',0).attr('rx',8).attr('ry',8).attr('width',0).attr('height',height).attr('fill','#4CAF50')
         .transition().duration(700).attr('width', width * p);
  
      svg.append('text').attr('x',width/2).attr('y',height/2).attr('dy','0.36em').attr('text-anchor','middle').attr('fill','#fff').attr('font-size',14)
         .text(m.total===0 ? 'No tasks yet' : `${pct}% complete (${m.completed}/${m.total})`);
    }
  
    function drawPie(m){
      const data = [{ values: [m.daily.total, m.weekly.total, m.monthly.total], labels:['Daily','Weekly','Monthly'], type:'pie',
        marker:{colors:['#4CAF50','#2196F3','#FF9800']}, textinfo:'label+value'}];
      const layout = { margin:{t:8,b:8,l:8,r:8}, height:220, paper_bgcolor: getComputedStyle(document.body).backgroundColor, font:{color:'#e6eef6'}};
      Plotly.newPlot('pie-chart-plot', data, layout, {responsive:true, displayModeBar:false});
    }
  
    function drawBar(m){
      const dp = m.daily.total ? (m.daily.completed/m.daily.total)*100 : 0;
      const wp = m.weekly.total ? (m.weekly.completed/m.weekly.total)*100 : 0;
      const mp = m.monthly.total ? (m.monthly.completed/m.monthly.total)*100 : 0;
      const data = [{ x:['Daily','Weekly','Monthly'], y:[dp,wp,mp], type:'bar', marker:{color:['#4CAF50','#2196F3','#FF9800']},
        hovertemplate:'%{x}: %{y:.1f}%<extra></extra>' }];
      const layout = { margin:{t:8,b:40,l:40,r:10}, height:260, yaxis:{range:[0,100],title:'Completion %', gridcolor:'#334155'}, font:{color:'#e6eef6'}, paper_bgcolor: getComputedStyle(document.body).backgroundColor, plot_bgcolor: getComputedStyle(document.body).backgroundColor};
      Plotly.newPlot('bar-chart-plot', data, layout, {responsive:true, displayModeBar:false});
    }
  
    function renderAll(){
      renderSlots();
      renderLists();
      const m = calculateMetrics();
      drawD3Progress(m);
      drawPie(m);
      drawBar(m);
      highlightPeriodButtons();
    }
  
    function highlightPeriodButtons(){
      periodBtns.forEach(b=>{
        const p = b.dataset.period;
        if(p === currentPeriod) b.classList.add('active'); else b.classList.remove('active');
      });
    }
  
    periodBtns.forEach(b=>{
      b.addEventListener('click', ()=>{
        const p = b.dataset.period;
        if(!p) return;
        currentPeriod = p;
        activeSlot = null;
        renderAll();
      });
    });
  
    clearFilterBtn.addEventListener('click', ()=>{
      activeSlot = null; renderAll();
    });
  
    jumpTodayBtn.addEventListener('click', ()=>{
      const now = new Date();
      if(currentPeriod==='weekly'){ activeSlot = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]; }
      else if(currentPeriod==='monthly'){
        const d = now.getDate();
        if(d<=7) activeSlot='1-7'; else if(d<=14) activeSlot='8-14'; else if(d<=21) activeSlot='15-21'; else if(d<=28) activeSlot='22-28'; else activeSlot='29-31';
      } else {
        const hr = now.getHours();
        if(hr<6) activeSlot='Early'; else if(hr<12) activeSlot='Morning'; else if(hr<14) activeSlot='Noon'; else if(hr<17) activeSlot='Afternoon'; else if(hr<20) activeSlot='Evening'; else activeSlot='Night';
      }
      renderAll();
    });
  
    if(tasks.length===0){
      tasks = [
        { id:uid(), name:'Read 20 pages', type:'daily', due: new Date(new Date().setHours(8,30,0,0)).toISOString(), completed:false, createdAt: Date.now()-1000*60*60*24 },
        { id:uid(), name:'Morning run', type:'daily', due: new Date(new Date().setHours(6,0,0,0)).toISOString(), completed:true, createdAt: Date.now()-1000*60*60*20 },
        { id:uid(), name:'Weekly planning', type:'weekly', due: (()=>{ const d = new Date(); d.setDate(d.getDate()+2); return d.toISOString(); })(), completed:false, createdAt: Date.now()-1000*60*60*48 },
        { id:uid(), name:'Pay rent', type:'monthly', due: (()=>{ const d = new Date(); d.setDate(5); return d.toISOString(); })(), completed:false, createdAt: Date.now()-1000*60*60*24*5 }
      ];
      save();
    }
  
    let rt = null;
    window.addEventListener('resize', ()=>{ clearTimeout(rt); rt = setTimeout(()=>{ renderAll(); }, 220); });
  
    renderAll();
  
    window.__taskDashboard = { tasks, addLocal: (n,t,d,ti)=>{ const dIso = isoCombine(d,ti); tasks.unshift({id:uid(), name:n, type:t, due: dIso?dIso.toISOString():null, completed:false, createdAt:Date.now()}); save(); renderAll(); } };
  })();