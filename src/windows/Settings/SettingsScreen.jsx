import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useSetting, APP_VERSION } from '../../lib/settings';
import { isLiquidGlassSupported, setLiquidGlassEnabled } from '../../lib/liquidGlass';
import Page from '../Feed/components/layout/Page';
import Avatar from '../Feed/components/post/Avatar';
import { useT, UI_LANGS } from '../../lib/i18n';
import {
  BellIcon,
  LogoutIcon,
  ArrowRightIcon,
} from '../../assets/icons/Icons';
import './SettingsScreen.css';

/*
 * У «Оформления», «Устройств» и «Языка» значков пока нет — нужных иконок
 * (palette, laptop, globe) нет в проекте; когда появятся из Telegram iOS kit,
 * их можно передать в <Row icon=…>.
 */

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

  return (
    <>
      <Page title={t('st.title')} pushed={false} active={active} slide={slide} onClose={onClose}>
        <button type="button" className="st-me" onClick={onOpenProfile}>
          <Avatar url={profile?.avatar_url} name={name} seed={user?.id} size={96} />
          <span className="st-me-name">{name}</span>
          <span className="st-me-sub">
            {[user?.email, profile?.username && `@${profile.username}`].filter(Boolean).join(' • ')}
          </span>
        </button>

        <Group>
          <Row label={t('st.appearance')}
            sub={glass && isLiquidGlassSupported() ? t('st.appearanceSubOn') : t('st.appearanceSub')}
            onClick={() => setSub('appearance')} />
          <Row icon={<BellIcon size={20} />} color="red" label={t('st.notifications')}
            sub={t('st.notificationsSub')} onClick={onOpenNotifications} />
          <Row label={t('st.devices')} sub={t('st.devicesSub')} onClick={() => setSub('devices')} />
          <Row label={t('st.language')} sub={t('st.languageSub', { ui: uiName, tr: trName })} onClick={() => setSub('language')} />
        </Group>

        <Group>
          <Row icon={<LogoutIcon size={18} />} color="gray" label={t('st.logout')} onClick={onLogout} danger />
        </Group>

        <div className="st-version">{t('st.version', { v: APP_VERSION })}</div>
      </Page>

      {active && sub === 'appearance' && <AppearancePage onClose={() => setSub(null)} />}
      {active && sub === 'devices' && <DevicesPage onClose={() => setSub(null)} />}
      {active && sub === 'language' && <LanguagePage onClose={() => setSub(null)} />}
    </>
  );
}
