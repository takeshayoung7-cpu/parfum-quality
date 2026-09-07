const OPTS = ["ЕВРО", "А+", "ЛЮКС", "VIP", "КОПИЯ"];

let DATA = [];
let queue = [];
let pos = 0;
let answers = {};
let history = [];
let sentOnce = false;

const $screen = document.getElementById("screen");
const $count  = document.getElementById("count");
const $fill   = document.getElementById("fill");
const $saved  = document.getElementById("saved");

function save(){
  try{ localStorage.setItem("pg_quality", JSON.stringify({answers:answers})); }catch(e){}
  $saved.textContent = "Сохранено";
  clearTimeout(save._t);
  save._t = setTimeout(function(){ $saved.textContent = ""; }, 1500);
}

function keyOf(q){
  const b = DATA[q.bi];
  if(q.type === "brand") return b.b;
  const it = b.items[q.ii];
  return b.b + " | " + it.m + (it.v ? " | " + it.v : "");
}

function answer(key, val){
  history.push({key:key, pos:pos, queueLen:queue.length});
  answers[key] = val;
  pos++;
  save();
  if(pos % 20 === 0) send("ПРОМЕЖУТОЧНО (" + pos + " из " + queue.length + ")\n\n" + summary()).catch(function(){});
  render();
}

function back(){
  if(!history.length) return;
  const h = history.pop();
  delete answers[h.key];
  if(queue.length > h.queueLen) queue.splice(h.pos+1, queue.length - h.queueLen);
  pos = h.pos;
  save();
  render();
}

function plural(n){
  const a = n % 10, b = n % 100;
  if(a === 1 && b !== 11) return "аромат";
  if(a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "аромата";
  return "ароматов";
}

function summary(){
  const groups = {};
  Object.keys(answers).forEach(function(k){
    const v = answers[k];
    if(v === "РАЗНЫЕ") return;
    (groups[v] = groups[v] || []).push(k);
  });
  const order = ["ЕВРО","А+","ЛЮКС","VIP","КОПИЯ","НЕ ЗНАЮ"];
  const keys = order.filter(function(k){ return groups[k]; })
    .concat(Object.keys(groups).filter(function(k){ return order.indexOf(k) < 0; }));
  let out = "КАЧЕСТВО АРОМАТОВ\n\n";
  keys.forEach(function(k){ out += k + ":\n" + groups[k].join("\n") + "\n\n"; });
  return out.trim();
}

async function send(text){
  const cfg = window.PG_CONFIG;
  const parts = [];
  let cur = "";
  text.split("\n").forEach(function(line){
    if((cur + line).length > 3200){ parts.push(cur); cur = ""; }
    cur += line + "\n";
  });
  if(cur.trim()) parts.push(cur);

  for(let i = 0; i < parts.length; i++){
    const r = await fetch("https://api.telegram.org/bot" + cfg.token + "/sendMessage", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({chat_id: cfg.chat, text: parts[i]})
    });
    if(!r.ok) throw new Error("http " + r.status);
  }
}

async function deliver(){
  const st  = document.getElementById("sendstatus");
  const btn = document.getElementById("sendagain");
  if(st) st.textContent = "Отправляем ответы…";
  try{
    await send(summary());
    sentOnce = true;
    if(st) st.textContent = "Ответы отправлены. Спасибо!";
    if(btn) btn.textContent = "Отправить ещё раз";
  }catch(e){
    if(st) st.textContent = "Не удалось отправить — проверьте интернет и нажмите кнопку ниже.";
  }
  if(btn) btn.style.display = "flex";
}

let locked = false;

function toast(text){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast"; t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.classList.remove("show"); }, 1400);
}

let picked = [];

function render(){
  const total = queue.length;
  $count.textContent = Math.min(pos + 1, total) + " из " + total;
  $fill.style.width = (pos / total * 100).toFixed(1) + "%";
  $screen.innerHTML = "";

  if(pos >= total){
    $count.textContent = total + " из " + total;
    $fill.style.width = "100%";

    const d = document.createElement("div");
    d.className = "card done";
    const h = document.createElement("h2");
    h.textContent = "Готово. Спасибо!";
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = "Все вопросы пройдены. Ответы отправляются автоматически — ничего делать не нужно.";
    d.appendChild(h); d.appendChild(p);
    $screen.appendChild(d);

    const st = document.createElement("p");
    st.className = "note"; st.id = "sendstatus";
    st.style.cssText = "margin-top:18px;font-size:17px";
    $screen.appendChild(st);

    const again = document.createElement("button");
    again.className = "primary"; again.id = "sendagain";
    again.textContent = "Отправить ещё раз";
    again.style.display = "none";
    again.addEventListener("click", deliver);
    $screen.appendChild(again);

    const f = document.createElement("div"); f.className = "foot";
    const b1 = document.createElement("button");
    b1.textContent = "← Изменить последний ответ";
    b1.addEventListener("click", back);
    f.appendChild(b1);
    const b2 = document.createElement("button");
    b2.textContent = "Начать заново";
    b2.addEventListener("click", resetAll);
    f.appendChild(b2);
    $screen.appendChild(f);

    if(!sentOnce) deliver();
    return;
  }

  const q = queue[pos];
  const brand = DATA[q.bi];
  const key = keyOf(q);

  const stage = document.createElement("div");
  stage.className = "stage enter";
  $screen.appendChild(stage);

  const num = document.createElement("p");
  num.className = "qnum";
  num.textContent = "Вопрос " + (pos + 1) + " из " + total;
  stage.appendChild(num);

  const card = document.createElement("div");
  card.className = "card";
  if(q.type === "brand"){
    const eb = document.createElement("p"); eb.className = "eyebrow"; eb.textContent = "Бренд";
    const h1 = document.createElement("h1"); h1.className = "brand"; h1.textContent = brand.b;
    const sub = document.createElement("p"); sub.className = "sub";
    sub.textContent = brand.items.length + " " + plural(brand.items.length) + " этого бренда";
    card.appendChild(eb); card.appendChild(h1); card.appendChild(sub);
  }else{
    const it = brand.items[q.ii];
    const eb = document.createElement("p"); eb.className = "eyebrow"; eb.textContent = brand.b;
    const md = document.createElement("p"); md.className = "model"; md.textContent = it.m;
    const sub = document.createElement("p"); sub.className = "sub"; sub.textContent = it.v || "";
    card.appendChild(eb); card.appendChild(md); card.appendChild(sub);
  }
  stage.appendChild(card);

  const qq = document.createElement("p");
  qq.className = "q";
  qq.textContent = "Какое качество?";
  stage.appendChild(qq);

  const hint = document.createElement("p");
  hint.className = "multi";
  hint.textContent = "Если качеств несколько — отметьте все подходящие";
  stage.appendChild(hint);

  picked = [];
  const next = document.createElement("button");

  const opts = document.createElement("div");
  opts.className = "opts";
  OPTS.forEach(function(name){
    const btn = document.createElement("button");
    btn.className = "opt";
    btn.textContent = name;
    btn.addEventListener("click", function(){
      const i = picked.indexOf(name);
      if(i < 0){ picked.push(name); btn.classList.add("chosen"); }
      else { picked.splice(i, 1); btn.classList.remove("chosen"); }
      next.disabled = picked.length === 0;
      next.textContent = picked.length ? "Далее →" : "Выберите качество";
    });
    opts.appendChild(btn);
  });
  stage.appendChild(opts);

  next.className = "primary";
  next.textContent = "Выберите качество";
  next.disabled = true;
  next.addEventListener("click", function(){
    if(locked || !picked.length) return;
    locked = true;
    const val = picked.join(" + ");
    toast("Записано: " + val);
    setTimeout(function(){ locked = false; answer(key, val); }, 240);
  });
  stage.appendChild(next);

  const foot = document.createElement("div");
  foot.className = "foot";
  const bBack = document.createElement("button");
  bBack.textContent = "← Назад";
  bBack.disabled = history.length === 0;
  bBack.style.opacity = history.length ? "1" : ".4";
  bBack.addEventListener("click", back);
  foot.appendChild(bBack);
  const bSkip = document.createElement("button");
  bSkip.textContent = "Не знаю";
  bSkip.addEventListener("click", function(){ answer(key, "НЕ ЗНАЮ"); });
  foot.appendChild(bSkip);
  stage.appendChild(foot);

  requestAnimationFrame(function(){ stage.classList.remove("enter"); });

}

function resetAll(){
  if(!confirm("Стереть все ответы и начать опрос заново?")) return;
  try{ localStorage.removeItem("pg_quality"); }catch(e){}
  answers = {}; history = []; pos = 0; sentOnce = false;
  queue = DATA.map(function(b, i){ return {type:"brand", bi:i}; });
  render();
  window.scrollTo(0, 0);
}

function restore(saved){
  if(!saved || !saved.answers) return;
  answers = saved.answers;
  queue = DATA.map(function(b, i){ return {type:"brand", bi:i}; });
  pos = 0; history = [];
  while(pos < queue.length){
    const q = queue[pos];
    const k = keyOf(q);
    if(!(k in answers)) break;
    if(answers[k] === "РАЗНЫЕ"){
      const subs = DATA[q.bi].items.map(function(_, ii){ return {type:"item", bi:q.bi, ii:ii}; });
      queue.splice.apply(queue, [pos+1, 0].concat(subs));
    }
    history.push({key:k, pos:pos, queueLen:queue.length});
    pos++;
  }
}

fetch("brands.json?v=4")
  .then(function(r){ return r.json(); })
  .then(function(json){
    DATA = json;
    queue = DATA.map(function(b, i){ return {type:"brand", bi:i}; });
    if(/(^|[?&])reset\b/.test(location.search)){
      try{ localStorage.removeItem("pg_quality"); }catch(e){}
    }else{
      try{ restore(JSON.parse(localStorage.getItem("pg_quality"))); }catch(e){}
    }
    render();
  })
  .catch(function(){
    $screen.innerHTML = '<div class="card"><p class="note">Не удалось загрузить список. Обновите страницу.</p></div>';
  });
