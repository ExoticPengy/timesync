(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))a(t);new MutationObserver(t=>{for(const i of t)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function d(t){const i={};return t.integrity&&(i.integrity=t.integrity),t.referrerPolicy&&(i.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?i.credentials="include":t.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(t){if(t.ep)return;t.ep=!0;const i=d(t);fetch(t.href,i)}})();class E{constructor(){this.people=[{id:"p1",name:"Person 1",availability:this.createEmptyGrid()}],this.activePersonId="p1",this.onUpdate=null}createEmptyGrid(){return Array(7).fill(0).map(()=>Array(24).fill(!1))}get activePerson(){return this.people.find(e=>e.id===this.activePersonId)}toggleSlot(e,d){const a=this.activePerson;a&&(a.availability[e][d]=!a.availability[e][d],this.notify())}clearActive(){const e=this.activePerson;e&&(e.availability=this.createEmptyGrid(),this.notify())}addPerson(){const e=`p${this.people.length+1}`;this.people.push({id:e,name:`Person ${this.people.length+1}`,availability:this.createEmptyGrid()}),this.activePersonId=e,this.notify()}switchPerson(e){this.activePersonId=e,this.notify()}getHeatmapData(){const e=Array(7).fill(0).map(()=>Array(24).fill(0));return this.people.forEach(d=>{d.availability.forEach((a,t)=>{a.forEach((i,o)=>{i&&e[t][o]++})})}),{density:e,max:this.people.length}}notify(){this.onUpdate&&this.onUpdate()}}function f(r,e,d=!1){const a=["MON","TUE","WED","THU","FRI","SAT","SUN"];r.innerHTML="";const t=document.createElement("div");t.className="grid",t.appendChild(document.createElement("div")),a.forEach(n=>{const l=document.createElement("div");l.className="day-label",l.textContent=n,t.appendChild(l)});let i=!1,o=!0;for(let n=0;n<24;n++){const l=document.createElement("div");l.className="hour-label",l.textContent=`${n}:00`,t.appendChild(l);for(let m=0;m<7;m++){const c=document.createElement("div");if(c.className="cell",d){c.classList.add("heatmap");const v=e.getHeatmapData(),y=v.density[m][n],h=v.max>0?y/v.max:0;y>0&&(c.style.background=`rgba(99, 102, 241, ${.1+h*.9})`,c.style.boxShadow=h>.5?`0 0 10px rgba(99, 102, 241, ${h*.5})`:"none"),c.addEventListener("mouseenter",b=>P(b,`${y} / ${v.max} available`)),c.addEventListener("mouseleave",S)}else e.activePerson.availability[m][n]&&c.classList.add("selected"),c.addEventListener("mousedown",()=>{i=!0,o=!e.activePerson.availability[m][n],u(m,n,o)}),c.addEventListener("mouseenter",()=>{i&&u(m,n,o)});t.appendChild(c)}}r.appendChild(t),window.addEventListener("mouseup",()=>{i=!1});function u(n,l,m){e.activePerson.availability[n][l]!==m&&e.toggleSlot(n,l)}}let p=null;function P(r,e){p||(p=document.createElement("div"),p.className="tooltip",document.body.appendChild(p)),p.textContent=e,p.style.display="block",p.style.left=`${r.pageX+10}px`,p.style.top=`${r.pageY+10}px`}function S(){p&&(p.style.display="none")}const s=new E,x=document.querySelector("#app");x.innerHTML=`
  <div class="container">
    <header>
      <h1>TimeSync</h1>
      <p>Synchronize schedules and find the perfect time for everyone.</p>
    </header>

    <div class="main-layout">
      <!-- Selector Column -->
      <section class="glass-card">
        <div class="grid-header">
          <div class="grid-title">Your Availability</div>
          <div id="person-selector-container"></div>
        </div>
        <div id="selector-grid"></div>
        <div class="controls">
          <button id="add-person" class="primary">Add Person</button>
          <button id="clear-grid">Clear</button>
        </div>
      </section>

      <!-- Heatmap Column -->
      <section class="glass-card">
        <div class="grid-header">
          <div class="grid-title">Group Sync Map</div>
          <div id="stats" style="color: var(--text-muted); font-size: 0.9rem;"></div>
        </div>
        <div id="heatmap-grid"></div>
        <div class="controls">
          <p style="color: var(--text-muted); font-size: 0.8rem;">
            Vibrant colors indicate higher availability among participants.
          </p>
        </div>
      </section>
    </div>

    <!-- Recommendations Section -->
    <section class="glass-card" style="margin-top: 2rem;">
      <div class="grid-header">
        <div class="grid-title">🏆 Top Recommended Times</div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">The best slots for everyone to meet.</p>
      </div>
      <div id="recommended-container"></div>
    </section>
  </div>
`;function g(){const r=document.querySelector("#person-selector-container");r.innerHTML=`
    <select id="person-select" style="background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 8px;">
      ${s.people.map(e=>`<option value="${e.id}" ${e.id===s.activePersonId?"selected":""}>${e.name}</option>`).join("")}
    </select>
  `,document.querySelector("#person-select").addEventListener("change",e=>{s.switchPerson(e.target.value)}),document.querySelector("#stats").textContent=`${s.people.length} Participant${s.people.length>1?"s":""}`,f(document.querySelector("#selector-grid"),s,!1),f(document.querySelector("#heatmap-grid"),s,!0),L()}function L(){const r=document.querySelector("#recommended-container"),e=s.getHeatmapData(),d=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],a=[];e.density.forEach((i,o)=>{i.forEach((u,n)=>{u>0&&a.push({day:d[o],hour:n,count:u})})}),a.sort((i,o)=>o.count-i.count||i.hour-o.hour);const t=a.slice(0,3);if(t.length===0){r.innerHTML='<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No times selected yet. Start marking your availability!</p>';return}r.innerHTML=`
    <div class="recommended-list">
      ${t.map((i,o)=>`
        <div class="recommended-item">
          <span class="recommended-rank">#${o+1}</span>
          <span class="recommended-time">${i.day} at ${i.hour}:00</span>
          <span class="recommended-count">${i.count} / ${s.people.length} People</span>
        </div>
      `).join("")}
    </div>
  `}document.querySelector("#add-person").addEventListener("click",()=>{s.addPerson()});document.querySelector("#clear-grid").addEventListener("click",()=>{s.clearActive()});s.onUpdate=g;g();
