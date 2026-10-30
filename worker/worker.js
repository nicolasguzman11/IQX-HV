const GH = 'https://nicolasguzman11.github.io/IQX-HV';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = await sessionToken(env);
    const cookieHeader = request.headers.get('Cookie') || '';
    const authenticated = cookieHeader.includes(`iqx_session=${token}`);
    // Segundo nivel: solo Sub Dirección Administrativa (Gestión de Contratos)
    const cToken = await contratosToken(env);
    const contratosOk = !!cToken && cookieHeader.includes(`iqx_contratos=${cToken}`);

    // Logo (public: the login page needs it before authentication)
    if (url.pathname === '/logo.png') {
      const resp = await fetch(GH + '/logo.png');
      const headers = new Headers(resp.headers);
      headers.set('Cache-Control', 'public, max-age=300');
      return new Response(resp.body, { status: resp.status, headers });
    }

    // Login form submission
    if (url.pathname === '/login' && request.method === 'POST') {
      const form = await request.formData();
      const user = (form.get('usuario') || '').toString();
      const pass = (form.get('clave') || '').toString();
      if (user === env.DASH_USER && pass === env.DASH_PASS) {
        const headers = new Headers();
        headers.append('Set-Cookie', `iqx_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
        headers.append('Location', '/menu');
        return new Response(null, { status: 302, headers });
      }
      return html(loginPage(true), 401);
    }

    // Acceso restringido a Gestión de Contratos
    if (url.pathname === '/acceso-contratos' && request.method === 'POST') {
      if (!authenticated) return redirectToLogin(url);
      if (!cToken) return html(restrictedPage(false, false), 503);
      const form = await request.formData();
      const user = (form.get('usuario') || '').toString();
      const pass = (form.get('clave') || '').toString();
      if (user === env.CONTRATOS_USER && pass === env.CONTRATOS_PASS) {
        const headers = new Headers();
        headers.append('Set-Cookie', `iqx_contratos=${cToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
        headers.append('Location', '/contratos');
        return new Response(null, { status: 302, headers });
      }
      return html(restrictedPage(true, true), 401);
    }

    // Logout
    if (url.pathname === '/logout') {
      const headers = new Headers();
      headers.append('Set-Cookie', 'iqx_contratos=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      headers.append('Set-Cookie', 'iqx_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      headers.append('Location', '/');
      return new Response(null, { status: 302, headers });
    }

    // Menu
    if (url.pathname === '/menu') {
      if (!authenticated) return redirectToLogin(url);
      return html(menuPage());
    }

    // Dashboards (proxied from GitHub Pages)
    if (url.pathname.startsWith('/dashboard')) {
      if (!authenticated) return redirectToLogin(url);
      return proxy(GH + '/' + url.search);
    }
    if (url.pathname.startsWith('/consultas')) {
      if (!authenticated) return redirectToLogin(url);
      return proxy(GH + '/consultas.html' + url.search);
    }
    if (url.pathname.startsWith('/contratos')) {
      if (!authenticated) return redirectToLogin(url);
      if (!contratosOk) return html(restrictedPage(false, !!cToken), cToken ? 200 : 503);
      return proxy(GH + '/contratos.html' + url.search);
    }

    // Root
    if (url.pathname === '/') {
      if (authenticated) return Response.redirect(url.origin + '/menu', 302);
      return html(loginPage(false));
    }

    return new Response('No encontrado', { status: 404 });
  }
};

async function proxy(target) {
  // Sin caché: siempre la versión más reciente publicada en GitHub Pages
  const sep = target.includes('?') ? '&' : '?';
  const resp = await fetch(target + sep + '_cb=' + Date.now(), { cf: { cacheTtl: 0, cacheEverything: false } });
  const headers = new Headers(resp.headers);
  headers.delete('content-security-policy');
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  return new Response(resp.body, { status: resp.status, headers });
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}

function redirectToLogin(url) {
  return Response.redirect(url.origin + '/', 302);
}

async function contratosToken(env) {
  if (!env.CONTRATOS_USER || !env.CONTRATOS_PASS) return '';
  const enc = new TextEncoder().encode('contratos:' + env.CONTRATOS_USER + ':' + env.CONTRATOS_PASS);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sessionToken(env) {
  const enc = new TextEncoder().encode(env.DASH_USER + ':' + env.DASH_PASS);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const FALLBACK_MARK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>`;

function logoBlock(size) {
  return `<div class="logo" style="--s:${size}px"><img src="/logo.png" alt="Hospital de Villarrica" onerror="this.parentNode.classList.add('nologo');this.remove()"><span class="mark">${FALLBACK_MARK}</span></div>`;
}

function pageShell(bodyHtml, extraCss = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gestión de Contratos · Hospital de Villarrica</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#EAF2F8; --bg-2:#F6F9FC; --glass:rgba(255,255,255,.72); --glass-line:rgba(15,36,56,.10);
    --teal:#1E9C8B; --teal-2:#12806F; --blue:#2B6CC4; --ink:#0F2438; --mute:#5B7385; --amber:#E8A33D;
    --mono:'IBM Plex Mono',ui-monospace,monospace; --sans:'IBM Plex Sans',-apple-system,'Segoe UI',sans-serif;
    --mx:50%; --my:30%;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;min-height:100%;}
  body{font-family:var(--sans); color:var(--ink); min-height:100vh; background:linear-gradient(160deg,var(--bg-2),var(--bg)); position:relative; overflow-x:hidden;}
  .aurora{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;}
  .aurora i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;will-change:transform;}
  .aurora i:nth-child(1){width:46vmax;height:46vmax;left:-12vmax;top:-14vmax;background:#7FD8CB;animation:f1 18s ease-in-out infinite alternate;}
  .aurora i:nth-child(2){width:40vmax;height:40vmax;right:-10vmax;top:10vh;background:#8DB6F0;animation:f2 22s ease-in-out infinite alternate;}
  .aurora i:nth-child(3){width:34vmax;height:34vmax;left:25vw;bottom:-18vmax;background:#F6D58E;opacity:.5;animation:f3 26s ease-in-out infinite alternate;}
  @keyframes f1{to{transform:translate(12vmax,8vmax) scale(1.15);}}
  @keyframes f2{to{transform:translate(-10vmax,10vmax) scale(.9);}}
  @keyframes f3{to{transform:translate(-14vmax,-6vmax) scale(1.2);}}
  .spot{position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(520px circle at var(--mx) var(--my), rgba(255,255,255,.85), transparent 60%);transition:background .08s;}
  body > main, body > header{position:relative;z-index:1;}
  .logo{
    width:var(--s); height:var(--s); border-radius:calc(var(--s)*.22); display:grid; place-items:center;
    background:#fff; padding:calc(var(--s)*.09); box-shadow:0 10px 30px -10px rgba(15,36,56,.35); border:1px solid rgba(15,36,56,.08); flex:none; overflow:hidden;
  }
  .logo img{max-width:100%; max-height:100%; object-fit:contain; display:block;}
  .logo .mark{display:none;}
  .logo.nologo{background:linear-gradient(135deg,var(--teal),var(--blue)); color:#fff; padding:0;}
  .logo.nologo .mark{display:block; width:55%; height:55%;}
  .mark svg{width:100%;height:100%;}
  @keyframes rise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}
  ${extraCss}
</style>
</head>
<body><div class="aurora"><i></i><i></i><i></i></div><div class="spot"></div>${bodyHtml}
<script>
(function(){var r=document.documentElement;addEventListener('pointermove',function(e){r.style.setProperty('--mx',e.clientX+'px');r.style.setProperty('--my',e.clientY+'px');},{passive:true});})();
</script></body>
</html>`;
}

function loginPage(showError, o = {}) {
  o = Object.assign({action:'/login', eyebrow:'Hospital de Villarrica', title:'Gestión de Contratos', sub:'Sub Departamento de Abastecimiento', button:'Ingresar al panel', badge:'Acceso restringido', foot:'Uso institucional', note:'', back:''}, o);
  const css = `
  body{display:flex;align-items:center;justify-content:center;padding:24px;}
  .card{
    width:100%; max-width:420px; padding:38px 34px 30px; border-radius:22px; background:var(--glass);
    border:1px solid var(--glass-line); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
    box-shadow:0 30px 80px -30px rgba(15,36,56,.35); animation:rise .6s ease both;
  }
  .brand{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;margin-bottom:22px;}
  .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal-2);}
  h1{margin:0;font-size:26px;line-height:1.15;font-weight:700;letter-spacing:-.01em;}
  h1 span{background:linear-gradient(90deg,var(--teal-2),var(--blue));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .sub{margin:0;color:var(--mute);font-size:13.5px;}
  .badge{
    display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:12px;margin-bottom:22px;
    background:rgba(30,156,139,.10);border:1px solid rgba(30,156,139,.30);color:var(--teal-2);
    font-family:var(--mono);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;line-height:1.4;
  }
  .badge svg{width:16px;height:16px;flex:none;}
  label{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin:0 0 7px;}
  .field{position:relative;margin-bottom:18px;}
  .field > svg.ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:var(--mute);pointer-events:none;}
  input{
    width:100%;padding:14px 44px 14px 42px;border-radius:12px;font:inherit;font-size:14.5px;color:var(--ink);
    background:rgba(255,255,255,.9);border:1px solid var(--glass-line);transition:border-color .15s, box-shadow .15s;
  }
  input::placeholder{color:#9AAEBB;}
  input:focus{outline:none;border-color:var(--teal-2);box-shadow:0 0 0 3px rgba(30,156,139,.20);}
  .eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;color:var(--mute);cursor:pointer;padding:8px;border-radius:8px;display:grid;place-items:center;}
  .eye:hover{color:var(--ink);} .eye svg{width:18px;height:18px;}
  .submit{
    width:100%;margin-top:6px;padding:14px;border:0;border-radius:12px;cursor:pointer;font:inherit;font-weight:600;font-size:15px;color:#fff;
    background:linear-gradient(90deg,var(--teal),var(--blue));display:flex;align-items:center;justify-content:center;gap:10px;
    box-shadow:0 12px 30px -10px rgba(30,156,139,.55);transition:transform .15s, filter .15s;
  }
  .submit:hover{transform:translateY(-1px);filter:brightness(1.08);} .submit svg{width:18px;height:18px;}
  .error{display:flex;gap:9px;align-items:center;margin-bottom:18px;padding:11px 14px;border-radius:12px;background:rgba(196,87,58,.10);border:1px solid rgba(196,87,58,.45);color:#B3412A;font-size:13px;}
  .error svg{width:16px;height:16px;flex:none;}
  .foot{margin-top:24px;padding-top:18px;border-top:1px solid var(--glass-line);text-align:center;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#7C93A3;line-height:1.7;}
  `;
  return pageShell(`
  <main class="card">
    <div class="brand">
      ${logoBlock(110)}
      <div class="eyebrow">${o.eyebrow}</div>
      <h1><span>${o.title}</span></h1>
      <p class="sub">${o.sub}</p>
    </div>
    ${showError ? `<div class="error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg><span>Usuario o clave incorrectos. Intenta de nuevo.</span></div>` : ''}
    ${o.note}
    <form method="POST" action="${o.action}">
      <label for="usuario">Usuario</label>
      <div class="field">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>
        <input type="text" id="usuario" name="usuario" placeholder="nombre.usuario" autocomplete="username" required autofocus>
      </div>
      <label for="clave">Contraseña</label>
      <div class="field">
        <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>
        <input type="password" id="clave" name="clave" placeholder="••••••••" autocomplete="current-password" required>
        <button type="button" class="eye" id="eye" aria-label="Mostrar u ocultar contraseña">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <button type="submit" class="submit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
        ${o.button}
      </button>
    </form>
    ${o.back}
    <div class="foot">
    <div class="badge" style="margin:0 0 14px;justify-content:center;text-align:center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
      <span>${o.badge}</span>
    </div>
      ${o.foot}</div>
  </main>
  <script>
    document.getElementById('eye').addEventListener('click', function(){
      var i = document.getElementById('clave');
      i.type = i.type === 'password' ? 'text' : 'password';
    });
  </script>`, css);
}

function restrictedPage(showError, configured) {
  const note = configured ? '' : '<div class="error"><span>El acceso a este panel aún no está configurado. Avisa a quien administra el portal.</span></div>';
  return loginPage(showError, {
    action: '/acceso-contratos',
    eyebrow: 'Hospital de Villarrica',
    title: 'Gestión de Contratos',
    sub: 'Acceso exclusivo · Sub Dirección Administrativa',
    button: 'Ingresar',
    badge: 'Acceso restringido',
    foot: 'Solo Sub Dirección Administrativa',
    note,
    back: '<p style="text-align:center;margin:16px 0 0"><a href="/menu" style="color:var(--mute);font-size:13px;text-decoration:none">← Volver al menú</a></p>'
  });
}

function menuPage() {
  const css = `
  .top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px clamp(16px,4vw,48px);}
  .who{display:flex;align-items:center;gap:14px;min-width:0;}
  .who .t1{font-weight:700;font-size:15px;line-height:1.2;}
  .who .t2{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--teal-2);margin-top:2px;}
  .logout{
    display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:10px;text-decoration:none;color:var(--mute);
    border:1px solid var(--glass-line);background:var(--glass);font-size:13px;font-weight:500;transition:color .15s,border-color .15s;
  }
  .logout:hover{color:var(--ink);border-color:var(--mute);} .logout svg{width:15px;height:15px;}
  main{max-width:1180px;margin:0 auto;padding:clamp(24px,6vh,64px) clamp(16px,4vw,48px) 60px;}
  .hero{margin-bottom:34px;animation:rise .6s ease both;}
  .hero .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal-2);margin-bottom:10px;}
  .hero h1{margin:0 0 8px;font-size:clamp(26px,4vw,40px);line-height:1.1;font-weight:700;letter-spacing:-.02em;}
  .hero h1 span{background:linear-gradient(90deg,var(--teal-2),var(--blue));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .hero p{margin:0;color:var(--mute);font-size:15px;max-width:60ch;}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;}
  @media (max-width:1100px){.cards{grid-template-columns:repeat(2,minmax(0,1fr));}}
  @media (max-width:640px){.cards{grid-template-columns:1fr;}}
  .tile{
    --c:var(--teal);
    position:relative;display:flex;flex-direction:column;gap:18px;min-height:300px;padding:26px 24px 22px;border-radius:20px;text-decoration:none;color:var(--ink);
    background:var(--glass);border:1px solid var(--glass-line);overflow:hidden;
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .25s,box-shadow .25s,background .25s;
    animation:rise .6s ease both;
  }
  .tile:nth-child(2){animation-delay:.08s;} .tile:nth-child(3){animation-delay:.16s;}
  .tile::before{
    content:"";position:absolute;inset:-1px;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .25s;
    background:radial-gradient(420px 220px at 20% 0%, color-mix(in srgb,var(--c) 28%, transparent), transparent 70%);
  }
  .tile:hover,.tile:focus-visible{transform:translateY(-6px);border-color:color-mix(in srgb,var(--c) 70%, transparent);box-shadow:0 26px 60px -24px color-mix(in srgb,var(--c) 45%, transparent);outline:none;}
  .tile:hover::before,.tile:focus-visible::before{opacity:1;}
  .ico{
    width:56px;height:56px;border-radius:16px;display:grid;place-items:center;color:#fff;position:relative;
    background:linear-gradient(135deg,var(--c),color-mix(in srgb,var(--c) 55%, #0b1a2a));
    box-shadow:0 12px 26px -10px color-mix(in srgb,var(--c) 70%, transparent);
  }
  .ico svg{width:28px;height:28px;}
  .live{
    position:absolute;top:24px;right:22px;display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--teal-2);
  }
  .live::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--teal-2);box-shadow:0 0 0 0 rgba(30,156,139,.6);animation:ping 2s infinite;}
  .live.lock{color:#A86500;}
  .live.lock::before{background:#E8A33D;animation:none;box-shadow:none;}
  @keyframes ping{0%{box-shadow:0 0 0 0 rgba(30,156,139,.5);}70%{box-shadow:0 0 0 8px rgba(30,156,139,0);}100%{box-shadow:0 0 0 0 rgba(30,156,139,0);}}
  .tile h2{margin:0;font-size:21px;line-height:1.2;font-weight:700;letter-spacing:-.01em;position:relative;}
  .tile p{margin:0;color:var(--mute);font-size:14px;line-height:1.5;position:relative;}
  .chips{display:flex;flex-wrap:wrap;gap:7px;position:relative;}
  .chips span{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;padding:4px 9px;border-radius:999px;border:1px solid var(--glass-line);color:var(--mute);background:rgba(255,255,255,.7);}
  .go{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid var(--glass-line);font-weight:600;font-size:14px;position:relative;}
  .go svg{width:20px;height:20px;color:var(--c);transition:transform .25s;}
  .tile:hover .go svg{transform:translateX(6px);}
  .foot{margin-top:40px;text-align:center;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#7C93A3;}
  `;
  const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  return pageShell(`
  <header class="top">
    <div class="who">
      ${logoBlock(46)}
      <div><div class="t1">Hospital de Villarrica</div><div class="t2">Sub Departamento de Abastecimiento</div></div>
    </div>
    <a class="logout" href="/logout">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      Cerrar sesión
    </a>
  </header>
  <main>
    <section class="hero">
      <div class="eyebrow">Gestión de Contratos</div>
      <h1>¿Qué quieres <span>revisar hoy?</span></h1>
    </section>
    <section class="cards">
      <a class="tile" style="--c:#1E9C8B" href="/dashboard?view=iqx">
        <span class="live">En vivo</span>
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></div>
        <h2>Intervenciones Quirúrgicas</h2>
        <p>Cumplimiento de las licitaciones de intervenciones quirúrgicas: avance, saldos y pagos por licitación.</p>
        <div class="chips"><span>Avance %</span><span>Saldos</span><span>Pagos</span></div>
        <div class="go">Abrir panel ${arrow}</div>
      </a>
      <a class="tile" style="--c:#3B7BD9" href="/dashboard?view=turnos">
        <span class="live">En vivo</span>
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
        <h2>Horas Médicas</h2>
        <p>Turnos y horas médicas: montos por estado, consumo por convenio, evolución mensual y especialidades.</p>
        <div class="chips"><span>Turnos</span><span>Convenios</span><span>Estado de pago</span></div>
        <div class="go">Abrir panel ${arrow}</div>
      </a>
      <a class="tile" style="--c:#8E5BB5" href="/consultas">
        <span class="live">En vivo</span>
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v6a4 4 0 008 0V3M10 13v2a5 5 0 0010 0v-1"/><circle cx="20" cy="12" r="2"/></svg></div>
        <h2>Consultas y Controles</h2>
        <p>Consultas médicas nuevas y controles: avance de las licitaciones vigentes, estado de pago y atenciones por especialidad.</p>
        <div class="chips"><span>Consultas</span><span>Controles</span><span>Licitaciones</span></div>
        <div class="go">Abrir panel ${arrow}</div>
      </a>
      <a class="tile" style="--c:#E8A33D" href="/contratos">
        <span class="live lock">Acceso restringido</span>
        <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg></div>
        <h2>Gestión de Contratos</h2>
        <p>Indicadores, vencimientos y avisos de contratos, y validación de órdenes de compra por responsable.</p>
        <div class="chips"><span>Vencimientos</span><span>Órdenes de compra</span><span>Acceso exclusivo</span></div>
        <div class="go">Abrir panel ${arrow}</div>
      </a>
    </section>
    <div class="foot">Información confidencial · uso exclusivo institucional</div>
  </main>`, css);
}
