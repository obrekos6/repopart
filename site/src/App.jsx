import React, { useEffect, useRef, useState } from 'react';
import { chats as chatsData, posts, trends, follow, me } from './data.js';
import { Avatar, Post, TABS, Dots, IconPlus, IconSearch, IconUp, IconBack } from './ui.jsx';

function useDesktop() {
  const q = '(min-width: 900px)';
  const [on, setOn] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return on;
}

/* общее состояние: лайки, чаты и сообщения */
function useStore() {
  const [liked, setLiked] = useState({});
  const [chats, setChats] = useState(chatsData);
  const like = (id) => setLiked((l) => ({ ...l, [id]: !l[id] }));
  const send = (id, text) => setChats((cs) => cs.map((c) => (c.id === id
    ? { ...c, time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }), messages: [...c.messages, { in: false, text }] }
    : c)));
  const read = (id) => setChats((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  return { liked, like, chats, send, read };
}

export default function App() {
  const desktop = useDesktop();
  const store = useStore();
  const [tab, setTab] = useState('feed');
  const [openChat, setOpenChat] = useState(null);
  return desktop
    ? <Desktop store={store} tab={tab} setTab={setTab} />
    : <Phone store={store} tab={tab} setTab={setTab} openChat={openChat} setOpenChat={setOpenChat} />;
}

/* ================= телефон ================= */

function Phone({ store, tab, setTab, openChat, setOpenChat }) {
  const chat = store.chats.find((c) => c.id === openChat);
  if (chat) return <ChatScreen key={chat.id} chat={chat} store={store} onBack={() => setOpenChat(null)} />;
  return (
    <div className="screen">
      <div className="scroll" key={tab} style={{ animation: 'appear .2s var(--ease)' }}>
        {tab === 'feed' && <div className="feed">{posts.map((p) => <Post key={p.id} post={p} liked={!!store.liked[p.id]} onLike={() => store.like(p.id)} />)}</div>}
        {tab === 'chats' && <ChatList chats={store.chats} onOpen={(id) => { store.read(id); setOpenChat(id); }} />}
        {tab === 'settings' && <Settings />}
        {tab === 'profile' && <Profile store={store} />}
      </div>
      <div className="fade-top" aria-hidden="true" />
      <div className="topbar">
        {tab === 'feed' && <>
          <button className="island-btn press" aria-label="Мой профиль" onClick={() => setTab('profile')}><Avatar who={me} size={44} pad={0} font={16} /></button>
          <div className="island island-title">Лента</div>
          <button className="island-btn press" aria-label="Новый пост"><IconPlus size={20} sw={2.2} /></button>
        </>}
        {tab === 'chats' && <>
          <button className="island-btn press" aria-label="Поиск"><IconSearch size={20} sw={2.2} /></button>
          <div className="island island-title">Чаты</div>
          <button className="island-btn press" aria-label="Новый чат"><IconPlus size={20} sw={2.2} /></button>
        </>}
        {tab === 'settings' && <div className="island island-title">Настройки</div>}
        {tab === 'profile' && <div className="island island-title">Профиль</div>}
      </div>
      <div className="fade-bot" aria-hidden="true" />
      <nav className="tabbar" aria-label="Разделы">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab press ${tab === id ? 'on' : ''}`} aria-label={label} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function ChatList({ chats, onOpen, active }) {
  return (
    <div>
      {chats.map((c) => (
        <button key={c.id} className={`chat-row ${active === c.id ? 'on' : ''}`} onClick={() => onOpen(c.id)}>
          <Avatar who={c} size={56} pad={4} font={19} />
          <span className="chat-info">
            <span className="chat-line"><span className="chat-name">{c.name}</span><span className="chat-time">{c.time}</span></span>
            <span className="chat-line" style={{ alignItems: 'center' }}>
              <span className="chat-last">{c.messages[c.messages.length - 1]?.text}</span>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* Переписка: сообщения внизу, островки сверху и снизу */
function Conversation({ chat, store, back, inPanel }) {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const scroller = useRef(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [chat.messages.length, chat.id]);
  const lastOut = [...chat.messages].reverse().findIndex((m) => !m.in);
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    store.send(chat.id, t);
    setText('');
  };
  return (
    <>
      <div className="scroll" ref={scroller}>
        <div className="messages">
          <div className="day">Сегодня</div>
          {chat.messages.map((m, i) => (
            <React.Fragment key={i}>
              <div className={`msg ${m.in ? 'in' : 'out'}`}>{m.text}</div>
              {lastOut === chat.messages.length - 1 - i && i === chat.messages.length - 1 && <div className="read">Доставлено · {chat.time}</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="fade-top" aria-hidden="true" />
      <div className="topbar">
        {back
          ? <button className="island-btn press" aria-label="Назад" onClick={back}><IconBack size={22} sw={2.2} /></button>
          : null}
        <button className="send press" aria-label={`Профиль: ${chat.name}`}><Avatar who={chat} size={44} pad={0} font={18} /></button>
        <div className="island island-title"><span className="name">{chat.name}</span><span className="status">в сети</span></div>
        <button className="island-btn press" aria-label="Меню" aria-expanded={menu} onClick={() => setMenu((v) => !v)}><Dots /></button>
      </div>
      {menu && <>
        <div className="backdrop" onClick={() => setMenu(false)} />
        <div className="menu" role="menu" style={inPanel ? undefined : { top: 'calc(env(safe-area-inset-top) + 114px)', right: 12 }}>
          <button role="menuitem" onClick={() => setMenu(false)}>Поиск сообщений</button>
          <button role="menuitem" onClick={() => setMenu(false)}>Без звука</button>
          <button role="menuitem" onClick={() => setMenu(false)}>Медиа и файлы</button>
          <button role="menuitem" className="danger" onClick={() => setMenu(false)}>Очистить историю</button>
        </div>
      </>}
      <div className="fade-bot" aria-hidden="true" />
      <form className="composer" onSubmit={submit}>
        <label className="island">
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Сообщение</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" enterKeyHint="send" />
        </label>
        <button type="submit" className="send press" aria-label="Отправить" disabled={!text.trim()}>
          <span><span style={{ color: '#fff', display: 'flex' }}><IconUp size={20} sw={2.4} /></span></span>
        </button>
      </form>
    </>
  );
}

function ChatScreen({ chat, store, onBack }) {
  return <div className="screen push"><Conversation chat={chat} store={store} back={onBack} /></div>;
}

function Settings() {
  const [notif, setNotif] = useState(true);
  const [sound, setSound] = useState(true);
  return (
    <>
      <div className="group">
        <button className="row" onClick={() => setNotif((v) => !v)} role="switch" aria-checked={notif}>
          <span className="grow">Уведомления<small>Сообщения и ответы</small></span><span className={`switch ${notif ? 'on' : ''}`} />
        </button>
        <button className="row" onClick={() => setSound((v) => !v)} role="switch" aria-checked={sound}>
          <span className="grow">Звуки</span><span className={`switch ${sound ? 'on' : ''}`} />
        </button>
      </div>
      <div className="group">
        <div className="row"><span className="grow">Тема</span><span className="val">Как на устройстве</span></div>
        <div className="row"><span className="grow">Язык</span><span className="val">Русский</span></div>
      </div>
      <div className="group">
        <button className="row danger">Выйти из аккаунта</button>
      </div>
    </>
  );
}

function Profile({ store }) {
  return (
    <>
      <div className="hero">
        <Avatar who={me} size={104} pad={4} font={40} />
        <h1>{me.name}</h1>
        <p>@{me.username}</p>
      </div>
      <div className="group">
        <button className="row"><span className="grow">Изменить профиль</span></button>
      </div>
      <div className="feed">{posts.slice(0, 1).map((p) => <Post key={p.id} post={p} liked={!!store.liked[p.id]} onLike={() => store.like(p.id)} />)}</div>
    </>
  );
}

/* ================= ПК ================= */

function Desktop({ store, tab, setTab }) {
  const [active, setActive] = useState(store.chats[0].id);
  const chat = store.chats.find((c) => c.id === active);
  return (
    <div className="desk">
      <nav className="desk-nav" aria-label="Разделы">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab press ${tab === id ? 'on' : ''}`} aria-label={label} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>

      {tab === 'chats' && <>
        <section className="panel list-col">
          <div className="scroll"><ChatList chats={store.chats} active={active} onOpen={(id) => { store.read(id); setActive(id); }} /></div>
          <div className="fade-top" aria-hidden="true" />
          <div className="topbar" style={{ padding: '10px 10px 0' }}>
            <label className="island" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', color: 'var(--sub)' }}>
              <IconSearch size={18} sw={2.2} />
              <input aria-label="Поиск" placeholder="Поиск" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15 }} />
            </label>
            <button className="island-btn press" aria-label="Новый чат"><IconPlus size={20} sw={2.2} /></button>
          </div>
        </section>
        <main className="panel main-col">{chat ? <Conversation key={chat.id} chat={chat} store={store} inPanel /> : <div className="empty">Выберите чат</div>}</main>
      </>}

      {tab === 'feed' && <>
        <main className="panel main-col">
          <div className="scroll" style={{ padding: '84px 16px 24px' }}>
            <div className="desk-feed feed" style={{ gap: 12 }}>
              <div className="new-post">
                <Avatar who={me} />
                <label><input aria-label="Новый пост" placeholder="Что нового?" /></label>
                <button className="btn press">Опубликовать</button>
              </div>
              {posts.map((p) => <Post key={p.id} post={p} liked={!!store.liked[p.id]} onLike={() => store.like(p.id)} compactShare={false} />)}
            </div>
          </div>
          <div className="fade-top" aria-hidden="true" />
          <div className="topbar">
            <div className="island island-title">Лента</div>
            <button className="island-btn press" aria-label="Новый пост"><IconPlus size={20} sw={2.2} /></button>
          </div>
        </main>
        <aside className="side-col">
          <section className="panel">
            <h2>В тренде</h2>
            {trends.map((t) => <div key={t.title} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span><span style={{ fontSize: 12, color: 'var(--sub)' }}>{t.meta}</span></div>)}
          </section>
          <section className="panel">
            <h2>На кого подписаться</h2>
            {follow.map((f) => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar who={f} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 15, fontWeight: 600 }}>{f.name}</span><span style={{ fontSize: 12, color: 'var(--sub)' }}>{f.meta}</span></span>
                <button className="btn ghost press">Подписаться</button>
              </div>
            ))}
          </section>
        </aside>
      </>}

      {(tab === 'settings' || tab === 'profile') && (
        <main className="panel main-col">
          <div className="scroll" style={{ padding: '84px 16px 24px' }}>
            <div className="desk-feed">{tab === 'settings' ? <Settings /> : <Profile store={store} />}</div>
          </div>
          <div className="fade-top" aria-hidden="true" />
          <div className="topbar"><div className="island island-title">{tab === 'settings' ? 'Настройки' : 'Профиль'}</div></div>
        </main>
      )}
    </div>
  );
}
