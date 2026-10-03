import { gradientFill, stickerSpectrum, gradientPanelHtml, bindGradientPanel, hudHtml, hudLabelHtml } from "./editor-gradient";
import "./editor-hud.css";
/** NOXEL Spectra overlay editor. Dégradés : moteur partagé avec l'outil Dégradé. */
export class SpectraOverlayEditor {
  static STICKERS = [
    { key: "stickers/01_Reactions/coeur", label: "Coeur" },
    { key: "stickers/01_Reactions/pouce_leve", label: "Pouce leve" },
    { key: "stickers/01_Reactions/applaudissements", label: "Applaudissements" },
    { key: "stickers/01_Reactions/sourire", label: "Sourire" },
    { key: "stickers/01_Reactions/clin_oeil", label: "Clin oeil" },
    { key: "stickers/01_Reactions/surprise", label: "Surprise" },
    { key: "stickers/01_Reactions/feu", label: "Feu" },
    { key: "stickers/01_Reactions/etincelles", label: "Etincelles" },
    { key: "stickers/02_Succes/etoile", label: "Etoile" },
    { key: "stickers/02_Succes/trophee", label: "Trophee" },
    { key: "stickers/02_Succes/medaille", label: "Medaille" },
    { key: "stickers/02_Succes/couronne", label: "Couronne" },
    { key: "stickers/02_Succes/coche", label: "Coche" },
    { key: "stickers/02_Succes/cible", label: "Cible" },
    { key: "stickers/02_Succes/fusee", label: "Fusee" },
    { key: "stickers/02_Succes/confettis", label: "Confettis" },
    { key: "stickers/03_Creation/ampoule", label: "Ampoule" },
    { key: "stickers/03_Creation/crayon", label: "Crayon" },
    { key: "stickers/03_Creation/pinceau", label: "Pinceau" },
    { key: "stickers/03_Creation/palette", label: "Palette" },
    { key: "stickers/03_Creation/appareil_photo", label: "Appareil photo" },
    { key: "stickers/03_Creation/baguette_magique", label: "Baguette magique" },
    { key: "stickers/03_Creation/bulle_dialogue", label: "Bulle dialogue" },
    { key: "stickers/03_Creation/note_musique", label: "Note musique" },
    { key: "stickers/04_Web_Affaires/graphique_hausse", label: "Graphique hausse" },
    { key: "stickers/04_Web_Affaires/loupe", label: "Loupe" },
    { key: "stickers/04_Web_Affaires/globe", label: "Globe" },
    { key: "stickers/04_Web_Affaires/lien", label: "Lien" },
    { key: "stickers/04_Web_Affaires/eclair", label: "Eclair" },
    { key: "stickers/04_Web_Affaires/bouclier", label: "Bouclier" },
    { key: "stickers/04_Web_Affaires/panier", label: "Panier" },
    { key: "stickers/04_Web_Affaires/calendrier", label: "Calendrier" },
    { key: "stickers/04_Web_Affaires/ordinateur", label: "Ordinateur" },
    { key: "stickers/04_Web_Affaires/telephone", label: "Telephone" },
    { key: "stickers/05_Decoration/soleil", label: "Soleil" },
    { key: "stickers/05_Decoration/lune", label: "Lune" },
    { key: "stickers/05_Decoration/nuage", label: "Nuage" },
    { key: "stickers/05_Decoration/arc_en_ciel", label: "Arc en ciel" },
    { key: "stickers/05_Decoration/fleur", label: "Fleur" },
    { key: "stickers/05_Decoration/feuille", label: "Feuille" },
    { key: "stickers/05_Decoration/papillon", label: "Papillon" },
    { key: "stickers/05_Decoration/flocon", label: "Flocon" },
    { key: "stickers/05_Decoration/goutte", label: "Goutte" },
    { key: "stickers/05_Decoration/diamant", label: "Diamant" },
    { key: "stickers/06_Etiquettes/nouveau", label: "Nouveau" },
    { key: "stickers/06_Etiquettes/promo", label: "Promo" },
    { key: "stickers/06_Etiquettes/gratuit", label: "Gratuit" },
    { key: "stickers/06_Etiquettes/top_choix", label: "Top choix" },
    { key: "stickers/06_Etiquettes/avant", label: "Avant" },
    { key: "stickers/06_Etiquettes/apres", label: "Apres" },
    { key: "stickers/06_Etiquettes/cent_pour_cent", label: "Cent pour cent" },
    { key: "stickers/06_Etiquettes/a_decouvrir", label: "A decouvrir" },
  ];
  static FORMES = [
    { key: "formes/01_Geometriques/rectangle", label: "Rectangle" },
    { key: "formes/01_Geometriques/rectangle_arrondi", label: "Rectangle arrondi" },
    { key: "formes/01_Geometriques/carre", label: "Carre" },
    { key: "formes/01_Geometriques/cercle", label: "Cercle" },
    { key: "formes/01_Geometriques/ellipse", label: "Ellipse" },
    { key: "formes/01_Geometriques/triangle", label: "Triangle" },
    { key: "formes/01_Geometriques/losange", label: "Losange" },
    { key: "formes/01_Geometriques/pentagone", label: "Pentagone" },
    { key: "formes/01_Geometriques/hexagone", label: "Hexagone" },
    { key: "formes/01_Geometriques/etoile", label: "Etoile" },
    { key: "formes/01_Geometriques/coeur", label: "Coeur" },
    { key: "formes/02_Reperes/ligne", label: "Ligne" },
    { key: "formes/02_Reperes/fleche_droite", label: "Fleche droite" },
    { key: "formes/02_Reperes/fleche_courbe", label: "Fleche courbe" },
    { key: "formes/02_Reperes/chevron", label: "Chevron" },
    { key: "formes/02_Reperes/croix", label: "Croix" },
    { key: "formes/02_Reperes/coche", label: "Coche" },
    { key: "formes/02_Reperes/arc", label: "Arc" },
    { key: "formes/02_Reperes/ligne_pointillee", label: "Ligne pointillee" },
    { key: "formes/03_Composition/banniere", label: "Banniere" },
    { key: "formes/03_Composition/ruban", label: "Ruban" },
    { key: "formes/03_Composition/badge", label: "Badge" },
    { key: "formes/03_Composition/bulle_dialogue", label: "Bulle dialogue" },
    { key: "formes/03_Composition/legende", label: "Legende" },
    { key: "formes/03_Composition/encadre", label: "Encadre" },
    { key: "formes/03_Composition/grille", label: "Grille" },
    { key: "formes/03_Composition/masque_circulaire", label: "Masque circulaire" },
  ];
  constructor(root, options = {}) {
    if (!(root instanceof HTMLElement)) throw new TypeError('root must be an HTMLElement');
    this.root = root;
    this.options = options;
    this.image = null;
    this.imageUrl = null;
    this.width = 1200;
    this.height = 800;
    this.items = [];
    this.selectedId = null;
    this.history = [];
    this.historyIndex = -1;
    this.pointerAction = null;
    this.nextId = 1;
    this.root.innerHTML = this.markup();
    this.canvas = this.root.querySelector('[data-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.assetImages = new Map();
    this.assetSvgTextCache = new Map();
    this.coloredImageCache = new Map();
    this.bind();
    this.preloadAssets();
    this.resetHistory();
    this.render();
    if (options.image) this.setImage(options.image);
  }

  preloadAssets() {
    const all = [...SpectraOverlayEditor.STICKERS, ...SpectraOverlayEditor.FORMES];
    for (const asset of all) {
      const img = new Image();
      img.onload = () => { this.assetImages.set(asset.key, img); this.render(); };
      img.src = `/stickers-pack/${asset.key}.svg`;
    }
  }

  markup() {
    return `<div class="sp-editor">
      <div class="sp-toolbar">
        ${hudLabelHtml('choose-file','Ouvrir une image','<input type="file" accept="image/*" data-open hidden>','sp-file')}
        <span class="sp-sep" aria-hidden="true"></span>
        ${hudHtml('add-text','+ Texte',{attrs:'data-action="text"'})}
        ${hudHtml('add-sticker','+ Sticker',{attrs:'data-action="sticker"'})}
        ${hudHtml('add-shape','+ Forme',{attrs:'data-action="shape"'})}
        <span class="sp-sep" aria-hidden="true"></span>
        ${hudHtml('undo','Annuler',{attrs:'data-action="undo"',title:'Annuler (Ctrl+Z)'})}
        ${hudHtml('redo','Rétablir',{attrs:'data-action="redo"',title:'Rétablir (Ctrl+Y)'})}
        <span class="sp-export">${hudHtml('export-png','Exporter PNG',{attrs:'data-action="export"'})}</span>
      </div>
      <div class="sp-body">
        <div class="sp-stage"><canvas data-canvas aria-label="Image avec éléments modifiables"></canvas><span class="sp-size" data-size></span></div>
        <aside class="sp-inspector">
          <h2>Éléments</h2>
          <p class="sp-help">Cliquez sur un élément pour le déplacer. Glissez le carré vert pour changer sa taille.</p>
          <div class="sp-section"><h3>Ajouter un sticker</h3><div class="sp-stickers" data-stickers></div></div><div class="sp-section"><h3>Ajouter une forme</h3><div class="sp-stickers" data-formes></div></div>
          <div class="sp-section"><h3>Calques</h3><div class="sp-layers" data-layers></div></div>
          <div class="sp-section" data-properties><h3>Propriétés</h3><p class="sp-help">Sélectionnez un élément.</p></div>
        </aside>
      </div>
      <div class="sp-status" role="status" data-status>Prêt. Les modifications restent locales à votre navigateur.</div>
    </div>`;
  }

  bind() {
    this.root.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action) this.action(action);
      const sticker = event.target.closest('[data-sticker]')?.dataset.sticker;
      if (sticker) this.addSticker(sticker);
      const forme = event.target.closest('[data-forme]')?.dataset.forme;
      if (forme) this.addSticker(forme);
      const layer = event.target.closest('[data-layer]')?.dataset.layer;
      if (layer) { this.selectedId = Number(layer); this.render(); }
    });
    this.root.querySelector('[data-open]').addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (file) this.setImage(file).catch(err => this.status(err.message));
      event.target.value = '';
    });
    this.canvas.addEventListener('pointerdown', event => this.pointerDown(event));
    this.canvas.addEventListener('pointermove', event => this.pointerMove(event));
    this.canvas.addEventListener('pointerup', event => this.pointerUp(event));
    this.canvas.addEventListener('pointercancel', event => this.pointerUp(event));
    this.canvas.addEventListener('dblclick', event => {
      const item = this.hitTest(this.point(event));
      if (item?.type === 'text') this.editText(item);
    });
    this.root.querySelector('[data-stickers]').innerHTML = SpectraOverlayEditor.STICKERS.map(a => `<button type="button" data-sticker="${a.key}" title="${a.label}" aria-label="Ajouter ${a.label}"><img src="/stickers-pack/${a.key}.svg" alt="" width="20" height="20" /></button>`).join('');
    this.root.querySelector('[data-formes]').innerHTML = SpectraOverlayEditor.FORMES.map(a => `<button type="button" data-forme="${a.key}" title="${a.label}" aria-label="Ajouter ${a.label}"><img src="/stickers-pack/${a.key}.svg" alt="" width="20" height="20" /></button>`).join('');
    // Keyboard shortcuts only act while the editor has focus.
    this.root.tabIndex = 0;
    this.keydown = event => {
      if (!this.root.contains(document.activeElement) && document.activeElement !== this.root) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); this.redo(); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedId != null) { event.preventDefault(); this.deleteSelected(); }
      if (event.key.startsWith('Arrow') && this.selected) { event.preventDefault(); this.selected.x += event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0; this.selected.y += event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0; this.commit(); }
    };
    document.addEventListener('keydown', this.keydown);
  }

  get selected() { return this.items.find(item => item.id === this.selectedId); }
  status(message) { this.root.querySelector('[data-status]').textContent = message; }
  snapshot() { return JSON.stringify(this.items); }
  resetHistory() { this.history = [this.snapshot()]; this.historyIndex = 0; }
  commit() {
    const next = this.snapshot();
    if (next !== this.history[this.historyIndex]) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(next);
      if (this.history.length > 60) this.history.shift();
      this.historyIndex = this.history.length - 1;
    }
    this.render();
  }
  restore(index) {
    if (index < 0 || index >= this.history.length) return;
    this.historyIndex = index;
    this.items = JSON.parse(this.history[index]);
    if (!this.selected) this.selectedId = null;
    this.render();
  }
  undo() { this.restore(this.historyIndex - 1); }
  redo() { this.restore(this.historyIndex + 1); }

  async setImage(source) {
    let url;
    if (source instanceof Blob) {
      if (!source.type.startsWith('image/')) throw new Error('Choisissez un fichier image.');
      url = URL.createObjectURL(source);
    } else if (typeof source === 'string') url = source;
    else if (source instanceof HTMLImageElement) url = source.currentSrc || source.src;
    else throw new TypeError('Source non prise en charge');
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    try { await image.decode(); }
    catch { if (source instanceof Blob) URL.revokeObjectURL(url); throw new Error('Impossible d’ouvrir cette image.'); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Dimensions invalides.');
    if (this.imageUrl) URL.revokeObjectURL(this.imageUrl);
    this.imageUrl = source instanceof Blob ? url : null;
    this.image = image;
    this.width = image.naturalWidth;
    this.height = image.naturalHeight;
    this.items = [];
    this.selectedId = null;
    this.resetHistory();
    this.render();
    this.status(`Image chargée : ${this.width} × ${this.height} px.`);
  }

  base(type) {
    const size = Math.max(36, Math.min(140, Math.round(this.width * .075)));
    return { id:this.nextId++, type, x:this.width/2, y:this.height/2, size, rotation:0, opacity:1, color:'#ffffff', shadow:false, fillMode:'solid', gradientStops:[{position:0,color:'#3ddc84'},{position:100,color:'#a855f7'}] };
  }
  addText(value = 'Votre texte') {
    const item = { ...this.base('text'), text:value, font:'Inter', bold:true, stroke:'#07090f', strokeWidth:0 };
    this.items.push(item); this.selectedId=item.id; this.commit(); return item;
  }
  addSticker(value = SpectraOverlayEditor.STICKERS[0].key) {
    const item = { ...this.base('sticker'), value, fillMode:'original', strokeColor:'__original__', strokeWidth:'__original__', size:Math.max(50,Math.round(this.width*.1)) };
    this.items.push(item); this.selectedId=item.id; this.commit(); return item;
  }

  async getStyledImage(key, fillStops, strokeColor, strokeWidth) {
    const cacheKey = [key, fillStops?JSON.stringify(fillStops):'orig', strokeColor, strokeWidth].join('::');
    if (this.coloredImageCache.has(cacheKey)) return this.coloredImageCache.get(cacheKey);
    let svgText = this.assetSvgTextCache.get(key);
    if (!svgText) {
      const res = await fetch(`/stickers-pack/${key}.svg`);
      svgText = await res.text();
      this.assetSvgTextCache.set(key, svgText);
    }
    let styled = svgText;
    if (fillStops && fillStops.svg) {
      // Motif calculé par le moteur : toutes les géométries, contours d'origine conservés
      styled = styled.replace(/<linearGradient id="spectrum"[^>]*>[\s\S]*?<\/linearGradient>/i, fillStops.svg);
    } else if (fillStops) {
      const sorted = fillStops.slice().sort((a,b) => a.position - b.position);
      const stopsMarkup = sorted.map(s => `<stop offset="${s.position}%" stop-color="${s.color}"/>`).join('');
      styled = styled.replace(
        /<linearGradient id="spectrum"[^>]*>[\s\S]*?<\/linearGradient>/i,
        `<linearGradient id="spectrum" x1="0" x2="1" y1="0" y2="1">${stopsMarkup}</linearGradient>`
      );
    }
    if (strokeColor !== '__original__') {
      styled = styled.replace(/stroke="#142132"/gi, `stroke="${strokeColor}"`);
    }
    if (strokeWidth !== '__original__') {
      styled = styled.replace(/stroke-width="[\d.]+"/gi, `stroke-width="${strokeWidth}"`);
    }
    const img = new Image();
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(styled);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = dataUrl;
    });
    this.coloredImageCache.set(cacheKey, img);
    return img;
  }
  addShape(shape = 'rectangle') {
    const item = { ...this.base('shape'), shape, size:Math.max(80,Math.round(this.width*.16)), color:'#3ddc84' };
    this.items.push(item); this.selectedId=item.id; this.commit(); return item;
  }
  deleteSelected() { this.items=this.items.filter(item=>item.id!==this.selectedId); this.selectedId=null; this.commit(); }
  moveLayer(direction) {
    const i=this.items.findIndex(item=>item.id===this.selectedId), j=i+direction;
    if(i<0||j<0||j>=this.items.length)return;
    [this.items[i],this.items[j]]=[this.items[j],this.items[i]];
    this.commit();
  }
  action(action) {
    if(action==='text') this.addText();
    if(action==='sticker') this.addSticker();
    if(action==='shape') this.addShape();
    if(action==='undo') this.undo();
    if(action==='redo') this.redo();
    if(action==='delete') this.deleteSelected();
    if(action==='up') this.moveLayer(1);
    if(action==='down') this.moveLayer(-1);
    if(action==='edit' && this.selected?.type==='text') this.editText(this.selected);
    if(action==='export') this.exportPng().then(blob => {
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url; link.download='spectra-edited.png'; link.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      this.status('PNG exporté à la résolution de l’image source.');
    }).catch(err=>this.status(err.message));
  }
  editText(item) {
    const next=prompt('Modifier le texte',item.text);
    if(next!=null) { item.text=next.slice(0,500); this.commit(); }
  }

  measure(item,ctx=this.ctx) {
    if(item.type==='text') {
      ctx.font=`${item.bold?'700 ':''}${item.size}px ${item.font}`;
      const lines=item.text.split('\n');
      return { w:Math.max(24,...lines.map(line=>ctx.measureText(line||' ').width)), h:item.size*1.25*lines.length };
    }
    return { w:item.size, h:item.size };
  }
  paintItem(ctx,item) {
    const {w,h}=this.measure(item,ctx);
    ctx.save(); ctx.translate(item.x,item.y); ctx.rotate(item.rotation*Math.PI/180); ctx.globalAlpha=item.opacity;
    if(item.shadow) { ctx.shadowColor='#000c';ctx.shadowBlur=Math.max(8,item.size*.16);ctx.shadowOffsetX=item.size*.06;ctx.shadowOffsetY=item.size*.06; }
    const fillStyle=()=>{
      if(item.fillMode==='gradient') return gradientFill(ctx,item,w,h);
      return item.color;
    };
    if(item.type==='text') {
      ctx.font=`${item.bold?'700 ':''}${item.size}px ${item.font}`;
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
      const lines=item.text.split('\n');
      const fs=fillStyle();
      lines.forEach((line,index)=>{
        const y=(index-(lines.length-1)/2)*item.size*1.25;
        if(item.strokeWidth){ctx.strokeStyle=item.stroke;ctx.lineWidth=item.strokeWidth;ctx.strokeText(line,0,y);}
        ctx.fillStyle=fs;ctx.fillText(line,0,y);
      });
    } else if(item.type==='sticker') {
      let fillStops=null;
      if(item.fillMode==='solid')fillStops=[{position:0,color:item.color},{position:100,color:item.color}];
      else if(item.fillMode==='gradient')fillStops=stickerSpectrum(item);
      let img;
      if(fillStops||item.strokeColor!=='__original__'||item.strokeWidth!=='__original__'){
        const cacheKey=[item.value,fillStops?JSON.stringify(fillStops):'orig',item.strokeColor,item.strokeWidth].join('::');
        img=this.coloredImageCache.get(cacheKey);
        if(!img)this.getStyledImage(item.value,fillStops,item.strokeColor,item.strokeWidth).then(()=>this.drawOnly());
      }
      if(!img) img=this.assetImages.get(item.value);
      if(img) ctx.drawImage(img,-item.size/2,-item.size/2,item.size,item.size);
    } else {
      ctx.fillStyle=fillStyle();ctx.beginPath();
      if(item.shape==='circle')ctx.arc(0,0,item.size/2,0,Math.PI*2);
      else if(item.shape==='star') {
        for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=item.size*(i%2?.22:.5);const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();
      } else ctx.roundRect(-w/2,-h/2,w,h,Math.max(4,item.size*.08));
      ctx.fill();
    }
    ctx.restore(); return {w,h};
  }
  render() {
    this.paintCanvas();
    this.root.querySelector('[data-size]').textContent=`${this.width} × ${this.height} px`;
    this.renderLayers();this.renderProperties();
  }
  paintCanvas() {
    this.canvas.width=this.width; this.canvas.height=this.height;
    const ctx=this.ctx;
    if(this.image)ctx.drawImage(this.image,0,0,this.width,this.height);
    else {const g=ctx.createLinearGradient(0,0,this.width,this.height);g.addColorStop(0,'#102542');g.addColorStop(.55,'#7137a5');g.addColorStop(1,'#3ddc84');ctx.fillStyle=g;ctx.fillRect(0,0,this.width,this.height);}
    for(const item of this.items)this.paintItem(ctx,item);
    const selected=this.selected;
    if(selected){
      const {w,h}=this.measure(selected);
      ctx.save();ctx.translate(selected.x,selected.y);ctx.rotate(selected.rotation*Math.PI/180);
      ctx.setLineDash([Math.max(4,this.width/300),Math.max(3,this.width/500)]);ctx.strokeStyle='#3ddc84';ctx.lineWidth=Math.max(2,this.width/600);
      ctx.strokeRect(-w/2-10,-h/2-10,w+20,h+20);ctx.setLineDash([]);
      ctx.fillStyle='#3ddc84';const handle=Math.max(13,this.width/80);ctx.fillRect(w/2+10-handle/2,h/2+10-handle/2,handle,handle);
      ctx.restore();
    }
  }
  renderLayers() {
    this.root.querySelector('[data-layers]').innerHTML=this.items.slice().reverse().map(item=>{
      const label=item.type==='text'?item.text.slice(0,24):item.type==='sticker'?item.value:`Forme : ${item.shape}`;
      const kind=item.type==='text'?'TEXTE':item.type==='sticker'?'STICKER':'FORME';
      return `<button type="button" data-layer="${item.id}" class="${item.id===this.selectedId?'active':''}"><span class="sp-layer-type">${kind}</span><span>${this.escape(label)}</span></button>`;
    }).join('')||'<p class="sp-help">Aucun calque ajouté.</p>';
  }
  escape(value) {return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  renderProperties() {
    const host=this.root.querySelector('[data-properties]'),item=this.selected;
    if(!item){host.innerHTML='<h3>Propriétés</h3><p class="sp-help">Sélectionnez un élément.</p>';return;}
    const sizeLabel=item.type==='text'?'Taille du texte':'Taille';
    const number=(label,key,value,min,max,step=1)=>`<label>${label}<input data-prop="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
    host.innerHTML=`<h3>Propriétés</h3>
      ${item.type==='text'?`<label>Texte<textarea data-prop="text" rows="3" maxlength="500">${this.escape(item.text)}</textarea></label><label>Police<select data-prop="font">${['Inter','Manrope','Space Grotesk','Anton','Bebas Neue','Oswald','Playfair Display','Lora','Merriweather','JetBrains Mono','Space Mono','Fira Code','Caveat','Pacifico','Dancing Script','Fredoka','Quicksand','Baloo 2'].map(f=>`<option ${item.font===f?'selected':''}>${f}</option>`).join('')}</select></label><label>Gras<input type="checkbox" data-prop="bold" ${item.bold?'checked':''}></label><label>Contour<input type="color" data-prop="stroke" value="${item.stroke}"></label>${number('Épaisseur du contour','strokeWidth',item.strokeWidth,0,60)}`:''}
      ${item.type==='shape'?`<label>Forme<select data-prop="shape">${['rectangle','circle','star'].map(s=>`<option ${item.shape===s?'selected':''} value="${s}">${s}</option>`).join('')}</select></label>`:''}
      <label>Type de remplissage<select data-prop="fillMode">${item.type==='sticker'?`<option value="original" ${item.fillMode==='original'?'selected':''}>Original (pack NOXEL)</option>`:''}<option value="solid" ${item.fillMode==='solid'?'selected':''}>Uni</option><option value="gradient" ${item.fillMode==='gradient'?'selected':''}>Dégradé</option></select></label>
      ${item.fillMode==='gradient'?gradientPanelHtml(item):item.fillMode==='solid'?`<label>Couleur<input type="color" data-prop="color" value="${item.color}"></label>`:''}
      ${item.type==='sticker'?`<label>Couleur du contour<input type="color" data-prop="strokeColor" value="${item.strokeColor==='__original__'?'#142132':item.strokeColor}"></label>${number("Épaisseur du contour","strokeWidthSticker",item.strokeWidth==='__original__'?18:item.strokeWidth,0,60)}${hudHtml('reset-colors','Réinitialiser le sticker',{attrs:'data-action="reset-color"',title:"Remet le remplissage et le contour d'origine"})}`:''}
      ${number(sizeLabel,'size',Math.round(item.size),12,Math.max(this.width,this.height)*2)}
      ${number('Rotation (°)','rotation',item.rotation,-360,360)}
      <label>Opacité <span>${Math.round(item.opacity*100)} %</span><input data-prop="opacity" type="range" min="0" max="100" value="${Math.round(item.opacity*100)}"></label>
      <label>Ombre<input type="checkbox" data-prop="shadow" ${item.shadow?'checked':''}></label>
      <div class="sp-order">${hudHtml('layer-down','Reculer',{attrs:'data-action="down"'})}${hudHtml('layer-up','Avancer',{attrs:'data-action="up"'})}${hudHtml('delete-layer','Supprimer',{attrs:'data-action="delete"'})}</div>`;
    host.querySelectorAll('[data-prop]').forEach(input=>{
      input.addEventListener('input',()=>{
        const key=input.dataset.prop;
        if(key==='text')item.text=input.value;
        else if(key==='bold'||key==='shadow')item[key]=input.checked;
        else if(key==='size'||key==='rotation'||key==='strokeWidth')item[key]=Number(input.value)||0;
        else if(key==='opacity')item.opacity=Number(input.value)/100;
        else if(key==='fillMode'){
          item.fillMode=input.value;
          if(item.type==='sticker')this.refreshStickerImage(item);
          this.commit();
          this.renderProperties();
          return;
        }
        else if((key==='color'||key==='gradientColor1'||key==='gradientColor2')&&item.type==='sticker'){
          item[key]=input.value;
          this.refreshStickerImage(item);
        }
        else if(key==='strokeColor'&&item.type==='sticker'){
          item.strokeColor=input.value;
          this.refreshStickerImage(item);
        }
        else if(key==='strokeWidthSticker'){
          item.strokeWidth=Number(input.value)||0;
          this.refreshStickerImage(item);
        }
        else item[key]=input.value;
        // Do not rebuild focused controls on each keystroke.
        this.drawOnly();
        if(key==='opacity')input.previousElementSibling.textContent=`${Math.round(item.opacity*100)} %`;
        if(key==='text')this.renderLayers();
      });
      input.addEventListener('change',()=>this.commit());
      if(input.dataset.prop==='text')input.addEventListener('blur',()=>this.commit());
    });
    if(item.fillMode==='gradient')bindGradientPanel(host,item,{
      draw:()=>{if(item.type==='sticker')this.refreshStickerImage(item);else this.drawOnly();},
      commit:()=>this.commit(),
      rerender:()=>{if(item.type==='sticker')this.refreshStickerImage(item);this.commit();}
    });
    const resetColorBtn=host.querySelector('[data-action="reset-color"]');
    if(resetColorBtn)resetColorBtn.addEventListener('click',()=>{
      item.fillMode='original';
      item.strokeColor='__original__';
      item.strokeWidth='__original__';
      this.commit();
      this.renderProperties();
    });
    host.querySelectorAll('[data-stop-index]').forEach(row=>{
      const index=Number(row.dataset.stopIndex);
      row.querySelectorAll('[data-stop-prop]').forEach(input=>{
        input.addEventListener('input',()=>{
          const prop=input.dataset.stopProp;
          item.gradientStops[index][prop]=prop==='position'?(Number(input.value)||0):input.value;
          if(item.type==='sticker')this.refreshStickerImage(item);
          this.drawOnly();
        });
        input.addEventListener('change',()=>this.commit());
      });
    });
    host.querySelectorAll('[data-remove-stop]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(item.gradientStops.length<=2)return;
        item.gradientStops.splice(Number(btn.dataset.removeStop),1);
        if(item.type==='sticker')this.refreshStickerImage(item);
        this.commit();
        this.renderProperties();
      });
    });
    const addStopBtn=host.querySelector('[data-action="add-stop"]');
    if(addStopBtn)addStopBtn.addEventListener('click',()=>{
      if(item.gradientStops.length>=10)return;
      const sorted=item.gradientStops.slice().sort((a,b)=>a.position-b.position);
      let gap=-1,at=0;
      for(let i=0;i<sorted.length-1;i++){const d=sorted[i+1].position-sorted[i].position;if(d>gap){gap=d;at=i;}}
      const newPosition=Math.round((sorted[at].position+sorted[at+1].position)/2);
      item.gradientStops.push({position:newPosition,color:'#ffffff'});
      if(item.type==='sticker')this.refreshStickerImage(item);
      this.commit();
      this.renderProperties();
    });
  }
  refreshStickerImage(item){
    let fillStops=null;
    if(item.fillMode==='solid')fillStops=[{position:0,color:item.color},{position:100,color:item.color}];
    else if(item.fillMode==='gradient')fillStops=stickerSpectrum(item);
    this.getStyledImage(item.value,fillStops,item.strokeColor,item.strokeWidth).then(()=>this.drawOnly());
  }
  drawOnly(){this.paintCanvas();}
  point(event) {const r=this.canvas.getBoundingClientRect();return {x:(event.clientX-r.left)*this.width/r.width,y:(event.clientY-r.top)*this.height/r.height};}
  localPoint(point,item){const dx=point.x-item.x,dy=point.y-item.y,a=-item.rotation*Math.PI/180;return {x:dx*Math.cos(a)-dy*Math.sin(a),y:dx*Math.sin(a)+dy*Math.cos(a)};}
  hitTest(point){return this.items.slice().reverse().find(item=>{const p=this.localPoint(point,item),{w,h}=this.measure(item);return Math.abs(p.x)<=w/2+12&&Math.abs(p.y)<=h/2+12;});}
  pointerDown(event){
    if(event.button!==0)return;
    const p=this.point(event),previous=this.selected,local=previous&&this.localPoint(p,previous),dim=previous&&this.measure(previous);
    const nearHandle=previous&&Math.abs(local.x-(dim.w/2+10))<Math.max(20,this.width/55)&&Math.abs(local.y-(dim.h/2+10))<Math.max(20,this.width/55);
    const item=nearHandle?previous:this.hitTest(p);
    this.selectedId=item?.id??null;
    this.pointerAction=item?{id:item.id,mode:nearHandle?'scale':'move',start:p,x:item.x,y:item.y,size:item.size}:null;
    if(item)this.canvas.setPointerCapture(event.pointerId);
    this.render();
  }
  pointerMove(event){
    if(!this.pointerAction)return;
    const item=this.items.find(x=>x.id===this.pointerAction.id),p=this.point(event),a=this.pointerAction;
    if(a.mode==='move'){item.x=a.x+p.x-a.start.x;item.y=a.y+p.y-a.start.y;}
    else {const startDistance=Math.hypot(a.start.x-a.x,a.start.y-a.y),currentDistance=Math.hypot(p.x-a.x,p.y-a.y);item.size=Math.max(12,Math.round(a.size*currentDistance/Math.max(startDistance,1)));}
    this.render();
  }
  pointerUp(){if(!this.pointerAction)return;this.pointerAction=null;this.commit();}
  async exportPng(){
    if(!this.image)throw new Error('Ouvrez d’abord une image à exporter.');
    const canvas=document.createElement('canvas');canvas.width=this.width;canvas.height=this.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(this.image,0,0,this.width,this.height);
    for(const item of this.items)this.paintItem(ctx,item);
    return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Export impossible.')), 'image/png');}catch(e){reject(e);}});
  }
  destroy(){document.removeEventListener('keydown',this.keydown);if(this.imageUrl)URL.revokeObjectURL(this.imageUrl);this.root.innerHTML='';}
}
