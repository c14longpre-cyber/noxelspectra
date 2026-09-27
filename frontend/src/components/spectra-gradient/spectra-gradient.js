/** NOXEL Spectra gradient editor — native browser module, no dependencies. */
export class SpectraGradientEditor {
  constructor(root, options = {}) {
    if (!(root instanceof HTMLElement)) throw new TypeError('root must be an HTMLElement');
    this.root = root;
    this.onChange = options.onChange || (() => {});
    this.nextId = 1;
    this.state = {
      type: 'linear', width: 1200, height: 800,
      x1: 0, y1: 50, x2: 100, y2: 50,
      cx: 50, cy: 50, radius: 72,
      stops: [this.stop(0, '#3ddc84'), this.stop(100, '#a855f7')],
      ...options.initial,
    };
    this.validateState();
    this.root.innerHTML = this.markup();
    this.canvas = this.root.querySelector('[data-preview]');
    this.ctx = this.canvas.getContext('2d');
    this.dragHandle = null;
    this.bind();
    this.renderStops();
    this.update();
  }
  stop(position, color, opacity=100) { return { id:this.nextId++, position, color, opacity }; }
  validateState() {
    const s=this.state;
    if(!['linear','radial'].includes(s.type))s.type='linear';
    for(const key of ['width','height'])s[key]=Math.max(16,Math.min(4096,Math.round(Number(s[key])||800)));
    for(const key of ['x1','y1','x2','y2','cx','cy'])s[key]=Math.max(0,Math.min(100,Number(s[key])||0));
    s.radius=Math.max(1,Math.min(200,Number(s.radius)||72));
    if(!Array.isArray(s.stops)||s.stops.length<2||s.stops.length>10)throw new Error('Il faut de 2 à 10 couleurs.');
    s.stops=s.stops.map(st=>({id:Number(st.id)||this.nextId++,position:Math.max(0,Math.min(100,Number(st.position)||0)),color:/^#[0-9a-fA-F]{6}$/.test(st.color)?st.color:'#000000',opacity:Math.max(0,Math.min(100,Number(st.opacity??100)))}));
    this.nextId=Math.max(this.nextId,...s.stops.map(st=>st.id+1));
  }
  markup() {return `<div class="sg-app">
    <header class="sg-header"><div><strong>NOXEL <span>Spectra</span></strong><small>Éditeur de dégradés · 2 à 10 couleurs</small></div><div class="sg-actions"><button type="button" data-action="reverse">Inverser</button><button type="button" data-action="spread">Répartir</button><button type="button" data-action="add">+ Couleur</button></div></header>
    <div class="sg-main"><section class="sg-preview"><canvas data-preview aria-label="Aperçu du dégradé avec points de contrôle X/Y"></canvas><p data-readout></p><div class="sg-actions"><button type="button" data-action="png">Télécharger PNG</button><button type="button" data-action="svg">Télécharger SVG</button><button type="button" data-action="copy">Copier CSS</button><button type="button" data-action="json">Copier JSON</button></div><p class="sg-note">Glissez les points sur l’image pour régler X/Y. Les guides ne seront pas exportés. PNG et SVG respectent exactement ces coordonnées.</p></section>
    <aside class="sg-controls"><h2>Réglages</h2><label>Type<select data-field="type"><option value="linear">Linéaire</option><option value="radial">Radial</option></select></label>
      <div class="sg-grid"><label>Largeur (px)<input type="number" min="16" max="4096" data-field="width"></label><label>Hauteur (px)<input type="number" min="16" max="4096" data-field="height"></label></div>
      <div data-linear><h3>Direction</h3><div class="sg-grid"><label>Départ X (%)<input type="number" min="0" max="100" step="1" data-field="x1"></label><label>Départ Y (%)<input type="number" min="0" max="100" step="1" data-field="y1"></label><label>Arrivée X (%)<input type="number" min="0" max="100" step="1" data-field="x2"></label><label>Arrivée Y (%)<input type="number" min="0" max="100" step="1" data-field="y2"></label></div></div>
      <div data-radial><h3>Centre et rayon</h3><div class="sg-grid"><label>Centre X (%)<input type="number" min="0" max="100" data-field="cx"></label><label>Centre Y (%)<input type="number" min="0" max="100" data-field="cy"></label><label>Rayon (% du petit côté)<input type="number" min="1" max="200" data-field="radius"></label></div></div>
      <h3>Couleurs <span data-count></span></h3><div data-stops class="sg-stops"></div>
      <h3>Préréglages</h3><div class="sg-actions sg-presets"><button type="button" data-preset="noxel">NOXEL</button><button type="button" data-preset="sunset">Coucher de soleil</button><button type="button" data-preset="ocean">Océan</button><button type="button" data-preset="rainbow">Spectre</button></div>
    </aside></div><div class="sg-status" data-status role="status">Prêt.</div>
  </div>`;}
  bind() {
    this.canvas.addEventListener('pointerdown',event=>{
      const p=this.canvasPoint(event),s=this.state;
      const points=s.type==='linear'?[['start',s.x1,s.y1],['end',s.x2,s.y2]]:[['center',s.cx,s.cy],['radius',s.cx+s.radius*Math.min(s.width,s.height)/s.width,s.cy]];
      const nearest=points.map(([name,x,y])=>({name,d:Math.hypot((x-p.x)*s.width/100,(y-p.y)*s.height/100)})).sort((a,b)=>a.d-b.d)[0];
      if(nearest.d>Math.max(30,Math.min(s.width,s.height)*.05))return;
      this.dragHandle=nearest.name;this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!this.dragHandle)return;
      const p=this.canvasPoint(event),s=this.state,cap=v=>Math.max(0,Math.min(100,Math.round(v)));
      if(this.dragHandle==='start'){s.x1=cap(p.x);s.y1=cap(p.y);}
      if(this.dragHandle==='end'){s.x2=cap(p.x);s.y2=cap(p.y);}
      if(this.dragHandle==='center'){s.cx=cap(p.x);s.cy=cap(p.y);}
      if(this.dragHandle==='radius')s.radius=Math.max(1,Math.min(200,Math.round(Math.hypot((p.x-s.cx)*s.width/100,(p.y-s.cy)*s.height/100)*100/Math.min(s.width,s.height))));
      this.update();
    });
    this.canvas.addEventListener('pointerup',()=>this.dragHandle=null);
    this.canvas.addEventListener('pointercancel',()=>this.dragHandle=null);
    this.root.addEventListener('click', e => {
      const action=e.target.closest('[data-action]')?.dataset.action;
      if(action)this.action(action);
      const preset=e.target.closest('[data-preset]')?.dataset.preset;
      if(preset)this.preset(preset);
      const remove=e.target.closest('[data-remove]')?.dataset.remove;
      if(remove)this.removeStop(Number(remove));
    });
    this.root.addEventListener('input', e => {
      const field=e.target.dataset.field;
      if(field){
        if(e.target.value==='')return;
        this.state[field]=field==='type'?e.target.value:Number(e.target.value);
        this.validateState();this.update(false);
      }
      const id=Number(e.target.closest('[data-stop]')?.dataset.stop);
      if(id){
        const stop=this.state.stops.find(st=>st.id===id);if(!stop)return;
        if(e.target.dataset.part==='color')stop.color=e.target.value;
        if(e.target.dataset.part==='position')stop.position=Math.max(0,Math.min(100,Number(e.target.value)||0));
        if(e.target.dataset.part==='opacity')stop.opacity=Math.max(0,Math.min(100,Number(e.target.value)||0));
        const row=e.target.closest('[data-stop]');
        if(e.target.dataset.part==='position')row.querySelector('[data-part="position-number"]').value=stop.position;
        if(e.target.dataset.part==='position-number'){
          stop.position=Math.max(0,Math.min(100,Number(e.target.value)||0));
          row.querySelector('[data-part="position"]').value=stop.position;
        }
        this.update(false);
      }
    });
    this.root.addEventListener('change', e => {
      if(e.target.dataset.field){this.validateState();this.update();}
      if(e.target.closest('[data-stop]'))this.update();
    });
  }
  renderStops() {
    const host=this.root.querySelector('[data-stops]');
    host.innerHTML=this.state.stops.map((st,i)=>`<div class="sg-stop" data-stop="${st.id}">
      <span class="sg-index">${i+1}</span><input type="color" data-part="color" value="${st.color}" aria-label="Couleur ${i+1}">
      <input type="range" data-part="position" min="0" max="100" value="${st.position}" aria-label="Position ${i+1}">
      <input type="number" data-part="position-number" min="0" max="100" value="${st.position}" aria-label="Position exacte ${i+1}"><span>%</span>
      <input type="number" data-part="opacity" min="0" max="100" value="${st.opacity}" title="Opacité (%)" aria-label="Opacité ${i+1}"><span>% α</span>
      <button type="button" data-remove="${st.id}" aria-label="Retirer la couleur ${i+1}" ${this.state.stops.length<=2?'disabled':''}>×</button>
    </div>`).join('');
    host.querySelectorAll('[data-part="position-number"]').forEach(input=>input.addEventListener('input',()=>{
      const st=this.state.stops.find(s=>s.id===Number(input.closest('[data-stop]').dataset.stop));
      if(input.value==='')return;
      st.position=Math.max(0,Math.min(100,Number(input.value)||0));
      input.closest('[data-stop]').querySelector('[data-part="position"]').value=st.position;
      this.update(false);
    }));
    this.root.querySelector('[data-count]').textContent=`${this.state.stops.length}/10`;
    this.root.querySelector('[data-action="add"]').disabled=this.state.stops.length>=10;
  }
  sorted() {return this.state.stops.slice().sort((a,b)=>a.position-b.position||a.id-b.id);}
  cssColor(st) {const r=parseInt(st.color.slice(1,3),16),g=parseInt(st.color.slice(3,5),16),b=parseInt(st.color.slice(5,7),16);return `rgba(${r}, ${g}, ${b}, ${Number((st.opacity/100).toFixed(2))})`;}
  createGradient(ctx,width,height) {
    const s=this.state;
    const grad=s.type==='linear'?ctx.createLinearGradient(s.x1*width/100,s.y1*height/100,s.x2*width/100,s.y2*height/100):ctx.createRadialGradient(s.cx*width/100,s.cy*height/100,0,s.cx*width/100,s.cy*height/100,s.radius*Math.min(width,height)/100);
    for(const st of this.sorted())grad.addColorStop(st.position/100,this.cssColor(st));
    return grad;
  }
  paint(ctx,width,height){ctx.clearRect(0,0,width,height);ctx.fillStyle=this.createGradient(ctx,width,height);ctx.fillRect(0,0,width,height);}
  canvasPoint(event){const r=this.canvas.getBoundingClientRect();return {x:(event.clientX-r.left)/r.width*100,y:(event.clientY-r.top)/r.height*100};}
  drawGuides(){
    const ctx=this.ctx,s=this.state,w=s.width,h=s.height;
    const handle=(x,y,label)=>{ctx.fillStyle='#07090f';ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,w/600);ctx.beginPath();ctx.arc(x,y,Math.max(10,w/90),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font=`${Math.max(13,w/62)}px sans-serif`;ctx.fillText(label,x+Math.max(14,w/60),y-8);};
    ctx.save();ctx.strokeStyle='#ffffffcc';ctx.lineWidth=Math.max(2,w/600);ctx.setLineDash([Math.max(5,w/130),Math.max(4,w/150)]);ctx.beginPath();
    if(s.type==='linear'){const x1=s.x1*w/100,y1=s.y1*h/100,x2=s.x2*w/100,y2=s.y2*h/100;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);handle(x1,y1,'A');handle(x2,y2,'B');}
    else {const x=s.cx*w/100,y=s.cy*h/100,r=s.radius*Math.min(w,h)/100;ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);handle(x,y,'C');handle(x+r,y,'R');}
    ctx.restore();
  }
  update(syncControls=true) {
    const s=this.state;
    this.canvas.width=s.width;this.canvas.height=s.height;
    this.paint(this.ctx,s.width,s.height);
    this.drawGuides();
    if(syncControls)this.root.querySelectorAll('[data-field]').forEach(input=>input.value=s[input.dataset.field]);
    this.root.querySelector('[data-linear]').hidden=s.type!=='linear';
    this.root.querySelector('[data-radial]').hidden=s.type!=='radial';
    this.root.querySelector('[data-readout]').textContent=`${s.width} × ${s.height} px · ${s.stops.length} couleurs · ${s.type==='linear'?'linéaire':'radial'}`;
    this.onChange(this.getGradient());
  }
  addStop(){
    if(this.state.stops.length>=10)return;
    const sorted=this.sorted();let gap=-1,at=0;
    for(let i=0;i<sorted.length-1;i++){const d=sorted[i+1].position-sorted[i].position;if(d>gap){gap=d;at=i;}}
    const a=sorted[at],b=sorted[at+1],newPosition=Math.round((a.position+b.position)/2);
    this.state.stops.push(this.stop(newPosition,'#ffffff'));
    this.renderStops();this.update();
  }
  removeStop(id){if(this.state.stops.length<=2)return;this.state.stops=this.state.stops.filter(st=>st.id!==id);this.renderStops();this.update();}
  preset(key){
    const palettes={noxel:['#3ddc84','#a855f7'],sunset:['#ffb35c','#ef487f','#6622ac'],ocean:['#082f49','#06b6d4','#3ddc84'],rainbow:['#ff4d6d','#ff9e42','#ffe767','#3ddc84','#39a6f2','#a855f7']};
    this.state.stops=palettes[key].map((color,i,arr)=>this.stop(Math.round(i*100/(arr.length-1)),color));
    this.renderStops();this.update();
  }
  action(action){
    if(action==='add')this.addStop();
    if(action==='reverse'){this.state.stops=this.state.stops.map(st=>({...st,position:100-st.position})).reverse();this.renderStops();this.update();}
    if(action==='spread'){this.state.stops=this.sorted().map((st,i,arr)=>({...st,position:Math.round(i*100/(arr.length-1))}));this.renderStops();this.update();}
    if(action==='png')this.exportPng().then(blob=>this.download(blob,'spectra-gradient.png')).catch(err=>this.status(err.message));
    if(action==='svg')this.download(new Blob([this.exportSvg()],{type:'image/svg+xml'}),'spectra-gradient.svg');
    if(action==='copy'||action==='json'){
      const content=action==='copy'?this.exportCss():JSON.stringify(this.getGradient(),null,2);
      navigator.clipboard.writeText(content).then(()=>this.status(action==='copy'?'CSS copié.':'JSON copié.')).catch(()=>this.status('Copie impossible : utilisez HTTPS ou localhost.'));
    }
  }
  status(message){this.root.querySelector('[data-status]').textContent=message;}
  download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);this.status(`${name} téléchargé.`);}
  getGradient(){return structuredClone(this.state);}
  setGradient(config){this.state={...this.state,...structuredClone(config)};this.validateState();this.renderStops();this.update();}
  async exportPng(){
    const canvas=document.createElement('canvas');canvas.width=this.state.width;canvas.height=this.state.height;
    this.paint(canvas.getContext('2d'),canvas.width,canvas.height);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Export PNG impossible.')),'image/png'));
  }
  exportSvg(){
    const s=this.state,attrs=s.type==='linear'?`x1="${s.x1*s.width/100}" y1="${s.y1*s.height/100}" x2="${s.x2*s.width/100}" y2="${s.y2*s.height/100}"`:`cx="${s.cx*s.width/100}" cy="${s.cy*s.height/100}" r="${s.radius*Math.min(s.width,s.height)/100}"`;
    const tag=s.type==='linear'?'linearGradient':'radialGradient';
    const stops=this.sorted().map(st=>`<stop offset="${st.position}%" stop-color="${st.color}" stop-opacity="${st.opacity/100}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${s.width}" height="${s.height}" viewBox="0 0 ${s.width} ${s.height}"><defs><${tag} id="gradient" gradientUnits="userSpaceOnUse" ${attrs}>${stops}</${tag}></defs><rect width="100%" height="100%" fill="url(#gradient)"/></svg>`;
  }
  exportCss(){
    const s=this.state,colors=this.sorted().map(st=>`${this.cssColor(st)} ${st.position}%`).join(', ');
    if(s.type==='radial')return `/* Rayon calculé pour ${s.width} × ${s.height} px. */\nbackground: radial-gradient(circle ${Math.round(s.radius*Math.min(s.width,s.height)/100)}px at ${s.cx}% ${s.cy}%, ${colors});`;
    const angle=(Math.atan2(s.x2-s.x1,s.y1-s.y2)*180/Math.PI+360)%360;
    return `/* Direction X/Y approchée en CSS; SVG et PNG sont exacts. */\nbackground: linear-gradient(${angle.toFixed(1)}deg, ${colors});`;
  }
  destroy(){this.root.innerHTML='';}
}
