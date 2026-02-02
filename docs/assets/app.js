/* Interactive exam app (data-driven)
   Jan 2021 4BI1/1B — Full paper
*/
(function(){
  const EXAM_JSON = 'assets/exam/jan2021_1b/exam.json';
  const STORAGE_KEY = 'jan2021_4BI1_1B_answers_v1';

  /** @type {Record<string, any>} */
  let state = {};
  try{ state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; }catch(e){ state = {}; }
  const save = ()=> localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const $ = (sel)=> document.querySelector(sel);

  function uid(id){ return `ans_${id}`; }
  function setValue(id, value){ state[uid(id)] = value; save(); }
  function getValue(id, fallback=''){ return (state[uid(id)] ?? fallback); }

  function el(tag, attrs={}, children=[]){
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs||{})){
      if(v === null || v === undefined || v === false) continue;
      if(k==='class') n.className = v;
      else if(k==='html') n.innerHTML = v;
      else if(k==='text') n.textContent = v;
      else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of (Array.isArray(children)?children:[children])) if(c) n.appendChild(c);
    return n;
  }

  function paragraph(text){
    return el('p',{text});
  }

  function shortInput(id, placeholder=''){
    const input = el('input',{class:'input-short', type:'text', placeholder});
    input.value = getValue(id,'');
    input.addEventListener('input', ()=> setValue(id, input.value));
    return input;
  }

  function longTextarea(id, placeholder=''){
    const ta = el('textarea',{class:'text-long', placeholder});
    ta.value = getValue(id,'');
    ta.addEventListener('input', ()=> setValue(id, ta.value));
    return ta;
  }

  function mcqSingle(id, options){
    const group = uid(id);
    const box = el('div',{class:'mcq'});
    const current = getValue(id,'');
    for(const opt of (options||[])){
      const rid = `${group}_${opt.key}`;
      const input = el('input',{type:'radio', name:group, id:rid, value:opt.key});
      if(current===opt.key) input.checked = true;
      input.addEventListener('change', ()=>{ if(input.checked) setValue(id, opt.key); });
      const label = el('label',{for:rid, text:`${opt.key}  ${opt.text}`});
      box.appendChild(el('div',{class:'choice'},[input,label]));
    }
    return box;
  }

  function sourcePagesPanel(sourcePages){
    const details = el('details',{class:'sources'});
    const summary = el('summary',{text:'View original exam pages (rendered)'});
    const wrap = el('div',{class:'sources__pages'});
    for(const p of (sourcePages||[])){
      const n = String(p).padStart(2,'0');
      wrap.appendChild(el('figure',{class:'source-page'},[
        el('img',{src:`assets/exam/jan2021_1b/pages/page-${n}.png`, alt:`Exam page ${p}`} ),
        el('figcaption',{class:'caption', text:`Page ${p}`}),
      ]));
    }
    details.appendChild(summary);
    details.appendChild(wrap);
    return details;
  }

  function renderItem(item){
    const marksText = (item.marks!==null && item.marks!==undefined) ? `(${item.marks})` : '';

    const head = el('div',{class:'q__head'},[
      el('div',{},[
        el('div',{class:'q__num', text: item.label || item.title || ''}),
      ]),
      el('div',{class:'marks', text: marksText}),
    ]);

    const promptNodes = (item.prompt||[]).map(paragraph);

    let inputNode = null;
    if(item.inputType==='mcq') inputNode = mcqSingle(item.id, item.options||[]);
    else if(item.inputType==='text') inputNode = shortInput(item.id,'Type your answer…');
    else inputNode = longTextarea(item.id,'Write your answer here…');

    return el('div',{class:'paper'},[
      el('h2',{text: item.title || 'Question'}),
      el('div',{class:'q'},[
        head,
        ...promptNodes,
        el('div',{class:'answer'},[inputNode]),
        sourcePagesPanel(item.sourcePages)
      ])
    ]);
  }

  function updateProgress(idx, total){
    const elProg = $('#progress');
    if(elProg) elProg.textContent = `Item ${idx+1} / ${total}`;
  }

  async function main(){
    const res = await fetch(EXAM_JSON, {cache:'no-store'});
    if(!res.ok) throw new Error(`Failed to load exam JSON (${res.status})`);
    const exam = await res.json();
    const items = exam.items || [];

    const host = $('#pageHost');
    const btnPrev = $('#btnPrev');
    const btnNext = $('#btnNext');
    const btnPrint = $('#btnPrint');
    const btnClear = $('#btnClear');

    let idx = 0;

    function render(){
      host.innerHTML='';
      host.appendChild(renderItem(items[idx]));
      updateProgress(idx, items.length);
      btnPrev.disabled = (idx<=0);
      btnNext.disabled = (idx>=items.length-1);
      window.scrollTo({top:0, behavior:'instant'});
    }

    btnPrev.addEventListener('click', ()=>{ if(idx>0){ idx--; render(); } });
    btnNext.addEventListener('click', ()=>{ if(idx<items.length-1){ idx++; render(); } });
    btnPrint.addEventListener('click', ()=> window.print());
    btnClear.addEventListener('click', ()=>{
      if(!confirm('Clear all saved answers for this paper?')) return;
      state = {}; save(); render();
    });

    // deep-linking: #item=ID or #n=12
    const hash = location.hash.replace('#','');
    if(hash){
      const m1 = hash.match(/item=([^&]+)/);
      const m2 = hash.match(/n=(\d+)/);
      if(m1){
        const id = decodeURIComponent(m1[1]);
        const found = items.findIndex(x=>x.id===id);
        if(found>=0) idx=found;
      } else if(m2){
        const n = parseInt(m2[1],10);
        if(Number.isFinite(n) && n>=1 && n<=items.length) idx=n-1;
      }
    }

    render();
  }

  main().catch(err=>{
    const host = document.getElementById('pageHost');
    if(host) host.appendChild(el('div',{class:'paper'},[
      el('h2',{text:'Error'}),
      el('p',{text:String(err)}),
      el('p',{text:'If you are viewing locally, serve this folder via a web server (GitHub Pages is fine).'}),
    ]));
    console.error(err);
  });
})();
