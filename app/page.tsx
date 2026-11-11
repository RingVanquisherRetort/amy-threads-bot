const features = [
  { n: '01', title: 'Находит аудиторию', text: 'Отслеживает открытые обсуждения и сигналы интереса по заданным темам, городам и ключевым словам.' },
  { n: '02', title: 'Создаёт контент', text: 'Готовит публикации и ответы в голосе бренда, учитывая контекст и редакционные правила.' },
  { n: '03', title: 'Работает по расписанию', text: 'Формирует очередь контента и публикует через подключённые платформы с управляемыми ограничениями.' },
  { n: '04', title: 'Считает результат', text: 'Помогает видеть путь от охвата и реакции до обращения, регистрации и целевого действия.' },
];

const useCases = [
  'Подбор персонала и поиск исполнителей',
  'Локальный бизнес и услуги',
  'Агентства и маркетинговые команды',
  'Онлайн-магазины и сервисы',
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="nav wrap">
        <a className="brand" href="#" aria-label="Amy 2.0 — главная"><span className="brand-mark">a</span><span>amy <b>2.0</b></span></a>
        <div className="nav-links"><a href="#platform">Платформа</a><a href="#how">Как работает</a><a href="#business">Для бизнеса</a></div>
        <a className="nav-cta" href="#contact">Обсудить проект <span>↗</span></a>
      </nav>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><i /> AI-МАРКЕТИНГОВАЯ СИСТЕМА</div>
          <h1>Маркетинг,<br/><em>который работает,</em><br/>пока вы заняты бизнесом.</h1>
          <p className="hero-lead">Amy 2.0 помогает находить аудиторию, создавать контент, вести коммуникацию и измерять результат. Не ещё один генератор текстов, а рабочий процесс в одной системе.</p>
          <div className="hero-actions"><a className="button button-primary" href="#contact">Обсудить внедрение <span>↗</span></a><a className="text-link" href="#platform">Изучить возможности <span>↓</span></a></div>
          <div className="hero-note"><span className="pulse" /> Начинаем с пилотных проектов и реальных задач бизнеса</div>
        </div>
        <div className="hero-visual" aria-label="Схема работы Amy 2.0">
          <div className="visual-glow" />
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="core"><span className="core-symbol">a.</span><small>AMY ENGINE</small><b>AI CORE</b></div>
          <div className="node node-top"><span>⌕</span><div><b>Поиск</b><small>сигналы и аудитория</small></div></div>
          <div className="node node-right"><span>✳</span><div><b>Контент</b><small>посты и ответы</small></div></div>
          <div className="node node-bottom"><span>↗</span><div><b>Результат</b><small>метрики и воронка</small></div></div>
          <div className="visual-caption">ОТ ИДЕИ ДО ИЗМЕРИМОГО ДЕЙСТВИЯ</div>
        </div>
      </section>

      <section className="trust-strip"><div className="wrap strip-inner"><span>ОДНА СИСТЕМА</span><b>Поиск</b><i>✳</i><b>Контент</b><i>✳</i><b>Коммуникация</b><i>✳</i><b>Аналитика</b></div></section>

      <section className="section wrap" id="platform">
        <div className="section-heading"><div><div className="eyebrow">ВОЗМОЖНОСТИ</div><h2>Не просто генерирует.<br/><em>Доводит до действия.</em></h2></div><p>Amy объединяет несколько маркетинговых задач в последовательный процесс, который можно адаптировать под нишу, аудиторию и цели компании.</p></div>
        <div className="feature-grid">{features.map((f) => <article className="feature-card" key={f.n}><div className="feature-top"><span>{f.n}</span><b>↗</b></div><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
      </section>

      <section className="dark-section" id="how"><div className="wrap process-wrap">
        <div className="eyebrow light">ПОНЯТНЫЙ ПРОЦЕСС</div><h2>От задачи бизнеса<br/>до <em>понятной системы.</em></h2>
        <div className="process-grid"><div><span>01 / НАСТРОЙКА</span><h3>Понимаем задачу</h3><p>Определяем аудиторию, площадки, тон общения и целевое действие.</p></div><div><span>02 / ЗАПУСК</span><h3>Подключаем процессы</h3><p>Настраиваем поиск, контент, очередь публикаций и уведомления.</p></div><div><span>03 / ОПТИМИЗАЦИЯ</span><h3>Смотрим на цифры</h3><p>Проверяем качество лидов, реакции и конверсию. Улучшаем то, что не работает.</p></div></div>
      </div></section>

      <section className="section wrap business-section" id="business">
        <div className="eyebrow">ГДЕ ПРИМЕНЯТЬ</div><h2>Подстраивается под<br/><em>ваш тип бизнеса.</em></h2>
        <div className="usecase-list">{useCases.map((u,i)=><div className="usecase" key={u}><span>0{i+1}</span><b>{u}</b><i>↗</i></div>)}</div>
        <p className="fine-print">Сценарии и доступные интеграции зависят от площадок, разрешений аккаунтов и задач проекта. Возможности, которые ещё не запущены, не выдаём за готовый функционал.</p>
      </section>

      <section className="contact-section" id="contact"><div className="wrap contact-inner"><div><div className="eyebrow light">ПЕРВЫЙ ШАГ</div><h2>Давайте найдём,<br/><em>что Amy сделает для вас.</em></h2><p>Расскажите, как вы привлекаете клиентов сейчас. Обсудим пилот, подходящие площадки и измеримый результат.</p></div><a className="button button-light" href="https://www.threads.net/@zumer_courier" target="_blank" rel="noreferrer">Написать в Threads <span>↗</span></a></div></section>

      <footer className="footer wrap"><a className="brand" href="#"><span className="brand-mark">a</span><span>amy <b>2.0</b></span></a><span>AI-маркетинг для реальных задач.</span><span>© 2026 Amy 2.0</span></footer>

const features = [
  { n: '01', title: 'Находит аудиторию', text: 'Отслеживает открытые обсуждения и сигналы интереса по заданным темам, городам и ключевым словам.' },
  { n: '02', title: 'Создаёт контент', text: 'Готовит публикации и ответы в голосе бренда, учитывая контекст и редакционные правила.' },
  { n: '03', title: 'Работает по расписанию', text: 'Формирует очередь контента и публикует через подключённые платформы с управляемыми ограничениями.' },
  { n: '04', title: 'Считает результат', text: 'Помогает видеть путь от охвата и реакции до обращения, регистрации и целевого действия.' },
];

const useCases = [
  'Подбор персонала и поиск исполнителей',
  'Локальный бизнес и услуги',
  'Агентства и маркетинговые команды',
  'Онлайн-магазины и сервисы',
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="nav wrap">
        <a className="brand" href="#" aria-label="Amy 2.0 — главная"><span className="brand-mark">a</span><span>amy <b>2.0</b></span></a>
        <div className="nav-links"><a href="#platform">Платформа</a><a href="#how">Как работает</a><a href="#business">Для бизнеса</a></div>
        <a className="nav-cta" href="#contact">Обсудить проект <span>↗</span></a>
      </nav>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><i /> AI-МАРКЕТИНГОВАЯ СИСТЕМА</div>
          <h1>Маркетинг,<br/><em>который работает,</em><br/>пока вы заняты бизнесом.</h1>
          <p className="hero-lead">Amy 2.0 помогает находить аудиторию, создавать контент, вести коммуникацию и измерять результат. Не ещё один генератор текстов, а рабочий процесс в одной системе.</p>
          <div className="hero-actions"><a className="button button-primary" href="#contact">Обсудить внедрение <span>↗</span></a><a className="text-link" href="#platform">Изучить возможности <span>↓</span></a></div>
          <div className="hero-note"><span className="pulse" /> Начинаем с пилотных проектов и реальных задач бизнеса</div>
        </div>
        <div className="hero-visual" aria-label="Схема работы Amy 2.0">
          <div className="visual-glow" />
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="core"><span className="core-symbol">a.</span><small>AMY ENGINE</small><b>AI CORE</b></div>
          <div className="node node-top"><span>⌕</span><div><b>Поиск</b><small>сигналы и аудитория</small></div></div>
          <div className="node node-right"><span>✳</span><div><b>Контент</b><small>посты и ответы</small></div></div>
          <div className="node node-bottom"><span>↗</span><div><b>Результат</b><small>метрики и воронка</small></div></div>
          <div className="visual-caption">ОТ ИДЕИ ДО ИЗМЕРИМОГО ДЕЙСТВИЯ</div>
        </div>
      </section>

      <section className="trust-strip"><div className="wrap strip-inner"><span>ОДНА СИСТЕМА</span><b>Поиск</b><i>✳</i><b>Контент</b><i>✳</i><b>Коммуникация</b><i>✳</i><b>Аналитика</b></div></section>

      <section className="section wrap" id="platform">
        <div className="section-heading"><div><div className="eyebrow">ВОЗМОЖНОСТИ</div><h2>Не просто генерирует.<br/><em>Доводит до действия.</em></h2></div><p>Amy объединяет несколько маркетинговых задач в последовательный процесс, который можно адаптировать под нишу, аудиторию и цели компании.</p></div>
        <div className="feature-grid">{features.map((f) => <article className="feature-card" key={f.n}><div className="feature-top"><span>{f.n}</span><b>↗</b></div><h3>{f.title}</h3><p>{f.text}</p></article>)}</div>
      </section>

      <section className="dark-section" id="how"><div className="wrap process-wrap">
        <div className="eyebrow light">ПОНЯТНЫЙ ПРОЦЕСС</div><h2>От задачи бизнеса<br/>до <em>понятной системы.</em></h2>
        <div className="process-grid"><div><span>01 / НАСТРОЙКА</span><h3>Понимаем задачу</h3><p>Определяем аудиторию, площадки, тон общения и целевое действие.</p></div><div><span>02 / ЗАПУСК</span><h3>Подключаем процессы</h3><p>Настраиваем поиск, контент, очередь публикаций и уведомления.</p></div><div><span>03 / ОПТИМИЗАЦИЯ</span><h3>Смотрим на цифры</h3><p>Проверяем качество лидов, реакции и конверсию. Улучшаем то, что не работает.</p></div></div>
      </div></section>

      <section className="section wrap business-section" id="business">
        <div className="eyebrow">ГДЕ ПРИМЕНЯТЬ</div><h2>Подстраивается под<br/><em>ваш тип бизнеса.</em></h2>
        <div className="usecase-list">{useCases.map((u,i)=><div className="usecase" key={u}><span>0{i+1}</span><b>{u}</b><i>↗</i></div>)}</div>
        <p className="fine-print">Сценарии и доступные интеграции зависят от площадок, разрешений аккаунтов и задач проекта. Возможности, которые ещё не запущены, не выдаём за готовый функционал.</p>
      </section>

      <section className="contact-section" id="contact"><div className="wrap contact-inner"><div><div className="eyebrow light">ПЕРВЫЙ ШАГ</div><h2>Давайте найдём,<br/><em>что Amy сделает для вас.</em></h2><p>Расскажите, как вы привлекаете клиентов сейчас. Обсудим пилот, подходящие площадки и измеримый результат.</p></div><a className="button button-light" href="https://www.threads.net/@zumer_courier" target="_blank" rel="noreferrer">Написать в Threads <span>↗</span></a></div></section>

      <footer className="footer wrap"><a className="brand" href="#"><span className="brand-mark">a</span><span>amy <b>2.0</b></span></a><span>AI-маркетинг для реальных задач.</span><span>© 2026 Amy 2.0</span></footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        :root{--ink:#171522;--muted:#777487;--violet:#7655e8;--line:#e9e7ef;--paper:#faf9fc}
        *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:'DM Sans',sans-serif}.site-shell{overflow:hidden}.wrap{width:min(1160px,calc(100% - 48px));margin:0 auto}
        .nav{height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);font:800 23px Manrope,sans-serif;letter-spacing:-1.2px}.brand b{color:var(--violet)}.brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:var(--violet);color:#fff;font:800 24px Manrope}.nav-links{display:flex;gap:34px}.nav-links a,.text-link{font-size:13px;color:#615e6e;text-decoration:none}.nav-cta{font-size:13px;text-decoration:none;color:var(--ink);font-weight:700}.nav-cta span,.button span{margin-left:12px;color:var(--violet)}
        .hero{display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:50px;padding-top:78px;padding-bottom:88px;min-height:620px}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:700;color:var(--violet);display:flex;align-items:center;gap:10px}.eyebrow i{width:7px;height:7px;background:#8d72f2;border-radius:50%}h1,h2{font:800 clamp(40px,5.2vw,68px)/1.08 Manrope,sans-serif;letter-spacing:-3.5px;margin:22px 0}h1 em,h2 em{font-style:normal;color:var(--violet)}.hero-lead{font-size:16px;line-height:1.8;color:var(--muted);max-width:540px}.hero-actions{display:flex;align-items:center;gap:28px;margin-top:32px}.button{display:inline-flex;align-items:center;justify-content:center;padding:17px 22px;border-radius:12px;text-decoration:none;font-size:13px;font-weight:700;transition:transform .2s}.button:hover{transform:translateY(-2px)}.button-primary{background:var(--violet);color:white;box-shadow:0 12px 28px #7655e833}.button-primary span{color:#d9ceff}.text-link span{margin-left:8px}.hero-note{font-size:11px;color:#9692a1;margin-top:36px;display:flex;align-items:center;gap:9px}.pulse{width:7px;height:7px;border-radius:50%;background:#48bd91;box-shadow:0 0 0 5px #48bd911c}
        .hero-visual{height:440px;position:relative;display:grid;place-items:center}.visual-glow{position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,#a994ff38,transparent 68%)}.orbit{position:absolute;border:1px solid #ded8f4;border-radius:50%;transform:rotate(-24deg)}.orbit-one{width:390px;height:230px}.orbit-two{width:300px;height:390px;transform:rotate(52deg)}.core{z-index:2;width:164px;height:164px;border-radius:50%;background:linear-gradient(145deg,#8d72f2,#5c3dc7);box-shadow:0 22px 60px #7655e855;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white}.core-symbol{font:800 66px Manrope;line-height:1}.core small{font-size:8px;letter-spacing:2px;opacity:.7}.core b{font-size:10px;letter-spacing:3px;margin-top:5px}.node{position:absolute;z-index:3;display:flex;align-items:center;gap:11px;padding:13px 16px;background:#fff;border:1px solid #efedf5;border-radius:14px;box-shadow:0 14px 35px #2b20400c;min-width:176px}.node>span{width:35px;height:35px;display:grid;place-items:center;border-radius:10px;background:#f0ecff;color:var(--violet);font-size:19px}.node b,.node small{display:block}.node b{font-size:12px}.node small{font-size:9px;color:#9995a4;margin-top:3px}.node-top{top:37px;left:8%}.node-right{right:-1%;top:46%}.node-bottom{bottom:34px;left:16%}.visual-caption{position:absolute;bottom:0;right:0;font-size:8px;letter-spacing:2px;color:#a09baa}
        .trust-strip{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff}.strip-inner{height:78px;display:flex;align-items:center;justify-content:space-between}.strip-inner span{font-size:9px;letter-spacing:2px;color:#a29eac}.strip-inner b{font:700 13px Manrope}.strip-inner i{font-style:normal;color:#a48ff4}
        .section{padding-top:110px;padding-bottom:110px}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:50px;margin-bottom:45px}.section h2,.dark-section h2,.contact-section h2{font-size:clamp(38px,4.5vw,56px);margin:18px 0}.section-heading>p{max-width:360px;color:var(--muted);font-size:14px;line-height:1.8;margin-bottom:8px}.feature-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.feature-card{background:#fff;border:1px solid var(--line);border-radius:17px;padding:25px 22px;min-height:225px}.feature-top{display:flex;justify-content:space-between;color:#aaa5b5;font-size:11px}.feature-top b{color:var(--violet);font-size:17px}.feature-card h3{font:700 17px Manrope;margin:35px 0 10px;letter-spacing:-.5px}.feature-card p{font-size:12px;line-height:1.7;color:var(--muted);margin:0}
        .dark-section{background:#171522;color:#fff;padding:100px 0}.light{color:#b7a7ff}.dark-section h2{margin-bottom:56px}.dark-section h2 em,.contact-section h2 em{color:#b7a7ff}.process-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:50px}.process-grid>div{border-top:1px solid #393646;padding-top:22px}.process-grid span{font-size:9px;letter-spacing:1.7px;color:#a995ff}.process-grid h3{font:700 19px Manrope;margin:22px 0 10px}.process-grid p{color:#aaa6b7;font-size:13px;line-height:1.8;max-width:290px}
        .business-section{max-width:1160px}.usecase-list{margin-top:48px;border-top:1px solid var(--line)}.usecase{height:76px;border-bottom:1px solid var(--line);display:grid;grid-template-columns:80px 1fr 30px;align-items:center}.usecase span{font-size:10px;color:#aaa5b5}.usecase b{font:600 17px Manrope}.usecase i{font-style:normal;color:var(--violet);font-size:18px}.fine-print{font-size:10px;line-height:1.7;color:#a09baa;margin-top:22px;max-width:720px}
        .contact-section{background:linear-gradient(120deg,#6243d2,#8b70ef);color:#fff;padding:85px 0}.contact-inner{display:flex;align-items:center;justify-content:space-between;gap:40px}.contact-section h2{margin:18px 0;font-size:clamp(36px,4.3vw,54px)}.contact-section p{max-width:490px;color:#e2dcff;font-size:13px;line-height:1.8}.button-light{background:#fff;color:#2a2142;white-space:nowrap}.button-light span{color:var(--violet)}
        .footer{min-height:100px;display:flex;align-items:center;justify-content:space-between;gap:20px}.footer>span{font-size:10px;color:#9995a4}
        @media(max-width:850px){.nav-links{gap:16px}.hero{grid-template-columns:1fr;padding-top:65px;gap:20px}.hero-visual{max-width:560px;width:100%;margin:0 auto}.feature-grid{grid-template-columns:repeat(2,1fr)}.section-heading{display:block}.section-heading>p{max-width:540px}.contact-inner{align-items:flex-start;flex-direction:column}.process-grid{gap:24px}}
        @media(max-width:560px){.wrap{width:min(100% - 36px,1160px)}.nav{height:72px}.nav-links{display:none}.nav-cta{font-size:11px}.hero{padding-top:54px;padding-bottom:58px;min-height:0}h1{font-size:43px;letter-spacing:-2.5px}.hero-lead{font-size:14px}.hero-actions{gap:18px;flex-wrap:wrap}.button{padding:15px 17px}.hero-visual{height:350px;transform:scale(.9);transform-origin:center}.orbit-one{width:320px;height:200px}.orbit-two{height:320px;width:250px}.core{width:140px;height:140px}.node{min-width:150px;padding:10px}.node-top{left:0;top:16px}.node-right{right:-7%;top:43%}.node-bottom{left:3%;bottom:17px}.visual-caption{font-size:7px}.strip-inner{height:auto;padding:20px 0;flex-wrap:wrap;gap:14px}.strip-inner span{width:100%}.section{padding-top:75px;padding-bottom:75px}.section h2,.dark-section h2,.contact-section h2{letter-spacing:-2px}.feature-grid{grid-template-columns:1fr}.feature-card{min-height:185px}.feature-card h3{margin-top:24px}.dark-section{padding:75px 0}.process-grid{grid-template-columns:1fr;gap:28px}.process-grid>div{padding-top:17px}.usecase{grid-template-columns:42px 1fr 20px;height:68px}.usecase b{font-size:14px}.contact-section{padding:70px 0}.footer{padding:25px 0;flex-wrap:wrap}.footer>span{width:calc(100% - 50px)}}
      `}</style>
    </main>
  );
}
