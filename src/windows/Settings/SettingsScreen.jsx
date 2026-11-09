import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useSetting, APP_VERSION } from '../../lib/settings';
import { isLiquidGlassSupported, setLiquidGlassEnabled } from '../../lib/liquidGlass';
import Page from '../Feed/components/layout/Page';
import Avatar from '../Feed/components/post/Avatar';
import { useT, UI_LANGS } from '../../lib/i18n';
import { isAdmin } from '../../lib/admin';
import { invalidateProfile } from '../../lib/profilesCache';
import { ArrowRightIcon } from '../../assets/icons/Icons';
import './SettingsScreen.css';

export const TRANSLATE_LANGS = [
  ['ru', 'Русский', 'Russian'],
  ['en', 'English', 'English'],
  ['uk', 'Українська', 'Ukrainian'],
  ['be', 'Беларуская', 'Belarusian'],
  ['kk', 'Қазақша', 'Kazakh'],
  ['de', 'Deutsch', 'German'],
  ['fr', 'Français', 'French'],
  ['es', 'Español', 'Spanish'],
  ['it', 'Italiano', 'Italian'],
  ['tr', 'Türkçe', 'Turkish'],
  ['zh-CN', '简体中文', 'Chinese (Simplified)'],
  ['ja', '日本語', 'Japanese'],
];

/* ---------- общие кусочки, как в Telegram ---------- */
function Group({ title, footer, children }) {
  return (
    <>
      <div className="st-group">
        {title && <div className="st-group-title">{title}</div>}
        {children}
      </div>
      {footer && <div className="st-footer">{footer}</div>}
    </>
  );
}

function Row({ icon, color, label, sub, value, onClick, danger, chevron = true }) {
  return (
    <button type="button" className={`st-row ${danger ? 'is-danger' : ''} ${icon ? '' : 'no-icon'}`} onClick={onClick}>
      {icon && <span className={`st-icon is-${color}`}>{icon}</span>}
      <span className="st-row-text">
        <span className="st-row-label">{label}</span>
        {sub && <span className="st-row-sub">{sub}</span>}
      </span>
      {value && <span className="st-row-value">{value}</span>}
      {chevron && !danger && <span className="st-chevron"><ArrowRightIcon size={14} /></span>}
    </button>
  );
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`st-switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="st-switch-knob" />
    </button>
  );
}

function ToggleRow({ label, sub, checked, onChange, disabled }) {
  return (
    <div className={`st-row is-static no-icon ${disabled ? 'is-disabled' : ''}`}>
      <span className="st-row-text">
        <span className="st-row-label">{label}</span>
        {sub && <span className="st-row-sub">{sub}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function RadioRow({ label, sub, checked, onClick }) {
  return (
    <button type="button" className="st-row" onClick={onClick}>
      <span className={`st-radio ${checked ? 'is-on' : ''}`} />
      <span className="st-row-text">
        <span className="st-row-label">{label}</span>
        {sub && <span className="st-row-sub">{sub}</span>}
      </span>
    </button>
  );
}

/* ---------- Оформление ---------- */
function AppearancePage({ onClose }) {
  const t = useT();
  const [textSize, setTextSize] = useSetting('textSize');
  const [glass, setGlass] = useSetting('liquidGlass');
  const supported = isLiquidGlassSupported();

  const toggleGlass = (on) => {
    setGlass(on);
    setLiquidGlassEnabled(on);
  };

  return (
    <Page title={t('st.appearance')} onClose={onClose}>
      <Group title={t('st.textSize')}>
        <div className="st-slider-row">
          <input
            type="range"
            min="14"
            max="22"
            step="1"
            value={textSize}
            onChange={(e) => setTextSize(Number(e.target.value))}
            className="st-slider"
            style={{ '--fill': `${((textSize - 14) / 8) * 100}%` }}
            aria-label={t('st.textSize')}
          />
          <span className="st-slider-value">{textSize}</span>
        </div>
        <div className="st-preview">
          <div className="st-preview-bubble" style={{ fontSize: textSize }}>
            {t('st.textPreview')}
          </div>
        </div>
      </Group>

      <Group
        title={t('st.effects')}
        footer={supported ? t('st.glassNote') : t('st.glassNoteUnsupported')}
      >
        <ToggleRow
          label={t('st.glass')}
          sub={supported ? (glass ? t('st.glassOn') : t('st.glassOff')) : t('st.glassUnsupported')}
          checked={supported && glass}
          onChange={toggleGlass}
          disabled={!supported}
        />
      </Group>

      <Group footer={t('st.themeNote')}>
        <div className="st-row is-static">
          <span className="st-row-text">
            <span className="st-row-label">{t('st.theme')}</span>
          </span>
          <span className="st-row-value">{t('st.themeAuto')}</span>
        </div>
      </Group>
    </Page>
  );
}

/* ---------- Устройства ---------- */
function describeDevice(t) {
  const ua = navigator.userAgent;
  const browser =
    /YaBrowser\/(\d+)/.exec(ua)?.[1] ? `${t('st.yandex')} ${/YaBrowser\/(\d+)/.exec(ua)[1]}` :
    /Edg\/(\d+)/.exec(ua)?.[1] ? `Edge ${/Edg\/(\d+)/.exec(ua)[1]}` :
    /OPR\/(\d+)/.exec(ua)?.[1] ? `Opera ${/OPR\/(\d+)/.exec(ua)[1]}` :
    /Firefox\/(\d+)/.exec(ua)?.[1] ? `Firefox ${/Firefox\/(\d+)/.exec(ua)[1]}` :
    /Chrome\/(\d+)/.exec(ua)?.[1] ? `Chrome ${/Chrome\/(\d+)/.exec(ua)[1]}` :
    /Version\/(\d+).*Safari/.exec(ua)?.[1] ? `Safari ${/Version\/(\d+).*Safari/.exec(ua)[1]}` : t('st.browser');
  const os =
    /Android ([\d.]+)/.exec(ua)?.[1] ? `Android ${/Android ([\d.]+)/.exec(ua)[1]}` :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Windows NT/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : '';
  return { browser, os };
}

function DevicesPage({ onClose }) {
  const t = useT();
  const { browser, os } = describeDevice(t);
  const [status, setStatus] = useState(null);

  const endOthers = async () => {
    if (!window.confirm(t('st.endOthersConfirm'))) return;
    setStatus('…');
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setStatus(error ? t('st.endOthersFail') + error.message : t('st.endOthersDone'));
  };

  return (
    <Page title={t('st.devices')} onClose={onClose}>
      <Group title={t('st.thisDevice')} footer={t('st.endOthersNote')}>
        <div className="st-row is-static">
          <span className="st-row-text">
            <span className="st-row-label">{browser}</span>
            <span className="st-row-sub">{t('st.version', { v: APP_VERSION })}{os ? ` · ${os}` : ''} · {t('st.online')}</span>
          </span>
        </div>
        <Row label={t('st.endOthers')} onClick={endOthers} danger />
      </Group>
      {status && <div className="st-footer is-status">{status}</div>}
    </Page>
  );
}

/* ---------- Язык ---------- */
function LanguagePage({ onClose }) {
  const t = useT();
  const [lang, setLang] = useSetting('lang');
  const [showTranslate, setShowTranslate] = useSetting('showTranslate');
  const [translateTo, setTranslateTo] = useSetting('translateTo');

  return (
    <Page title={t('st.language')} onClose={onClose}>
      <Group title={t('st.uiLang')} footer={t('st.uiLangNote')}>
        {UI_LANGS.map(([code, name, en]) => (
          <RadioRow key={code} label={name} sub={en} checked={(lang || 'ru') === code} onClick={() => setLang(code)} />
        ))}
      </Group>

      <Group title={t('st.translateSection')} footer={t('st.translateNote')}>
        <ToggleRow label={t('st.showTranslate')} checked={showTranslate} onChange={setShowTranslate} />
      </Group>

      {showTranslate && (
        <Group title={t('st.translateTo')}>
          {TRANSLATE_LANGS.map(([code, name, en]) => (
            <RadioRow key={code} label={name} sub={en} checked={translateTo === code} onClick={() => setTranslateTo(code)} />
          ))}
        </Group>
      )}
    </Page>
  );
}

/* ---------- админ-панель ---------- */
function AdminPage({ me, onClose }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      let q = supabase.from('profiles').select('*').limit(50);
      // символы, которые в фильтре Supabase имеют особый смысл, убираем
      const text = query.trim().replace(/^@/, '').replace(/[%_,()*\\]/g, '');
      if (text) q = q.or(`username.ilike.%${text}%,display_name.ilike.%${text}%`);
      const { data } = await q.order('created_at', { ascending: false });
      if (alive) setUsers(data || []);
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  const setFlag = async (u, field, value) => {
    if (field === 'is_banned' && value && !window.confirm(t('admin.confirmBan', { name: u.display_name || u.username || '' }))) return;
    const { data, error } = await supabase.from('profiles').update({ [field]: value }).eq('id', u.id).select();
    // без прав база не вернёт ошибку, а просто не изменит ни одной строки
    if (error || !data?.length) { alert(t('admin.fail')); return; }
    invalidateProfile(u.id);
    setUsers((list) => list.map((x) => (x.id === u.id ? data[0] : x)));
  };

  return (
    <Page title={t('admin.title')} onClose={onClose}>
      <input
        className="adm-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('admin.search')}
        aria-label={t('admin.search')}
      />
      {users && users.length === 0 && <div className="st-footer">{t('admin.empty')}</div>}
      {users && users.length > 0 && (
        <div className="st-group">
          {users.map((u) => {
            const name = u.display_name || u.username || u.id.slice(0, 6);
            return (
              <div className="adm-user" key={u.id}>
                <Avatar url={u.avatar_url} name={name} seed={u.id} size={44} />
                <span className="st-row-text">
                  <span className="st-row-label">{name}</span>
                  <span className="st-row-sub">{u.username ? `@${u.username}` : ''}{u.is_banned ? ` · ${t('admin.banned')}` : ''}</span>
                </span>
                <span className="adm-actions">
                  <button type="button" className={`adm-btn ${u.is_verified ? 'is-on' : ''}`} onClick={() => setFlag(u, 'is_verified', !u.is_verified)}>
                    {u.is_verified ? t('admin.unverify') : t('admin.verify')}
                  </button>
                  {u.id !== me?.id && (
                    <button type="button" className="adm-btn is-danger" onClick={() => setFlag(u, 'is_banned', !u.is_banned)}>
                      {u.is_banned ? t('admin.unban') : t('admin.ban')}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}

/* ---------- главный экран настроек ---------- */
export default function SettingsScreen({ user, profile, active, slide, onClose, onOpenProfile, onOpenNotifications, onLogout }) {
  const t = useT();
  const [sub, setSub] = useState(null);
  const [glass] = useSetting('liquidGlass');
  const [translateTo] = useSetting('translateTo');
  const [lang] = useSetting('lang');
  const name = profile?.display_name || profile?.username || t('st.profileFallback');
  const trName = TRANSLATE_LANGS.find(([c]) => c === translateTo)?.[1] || 'Русский';
  const uiName = UI_LANGS.find(([c]) => c === (lang || 'ru'))?.[1] || 'Русский';
  // имя в шапке проявляется, пока блок с аватаркой уезжает вверх
  const onBodyScroll = (e) => {
    e.currentTarget.parentElement.style.setProperty('--p', String(Math.min(1, e.currentTarget.scrollTop / 110)));
  };

  return (
    <>
      <Page title={name} pushed={false} active={active} slide={slide} onClose={onClose} className="settings-page" onBodyScroll={onBodyScroll}>
        <button type="button" className="st-me" onClick={onOpenProfile}>
          <Avatar url={profile?.avatar_url} name={name} seed={user?.id} size={112} />
          <span className="st-me-name">{name}</span>
          <span className="st-me-sub">
            {[user?.email, profile?.username && `@${profile.username}`].filter(Boolean).join(' • ')}
          </span>
        </button>

        <Group>
          <Row label={t('st.appearance')}
            sub={glass && isLiquidGlassSupported() ? t('st.appearanceSubOn') : t('st.appearanceSub')}
            onClick={() => setSub('appearance')} />
          <Row label={t('st.notifications')}
            sub={t('st.notificationsSub')} onClick={onOpenNotifications} />
          <Row label={t('st.devices')} sub={t('st.devicesSub')} onClick={() => setSub('devices')} />
          <Row label={t('st.language')} sub={t('st.languageSub', { ui: uiName, tr: trName })} onClick={() => setSub('language')} />
        </Group>

        {isAdmin(user) && (
          <Group>
            <Row label={t('admin.title')} sub={t('admin.sub')} onClick={() => setSub('admin')} />
          </Group>
        )}

        <Group>
          <Row label={t('st.logout')} onClick={onLogout} danger />
        </Group>

        <div className="st-version">{t('st.version', { v: APP_VERSION })}</div>
      </Page>

      {active && sub === 'appearance' && <AppearancePage onClose={() => setSub(null)} />}
      {active && sub === 'devices' && <DevicesPage onClose={() => setSub(null)} />}
      {active && sub === 'language' && <LanguagePage onClose={() => setSub(null)} />}
      {active && sub === 'admin' && isAdmin(user) && <AdminPage me={user} onClose={() => setSub(null)} />}
    </>
  );
}
