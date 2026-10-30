import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { invalidateProfile } from '../../../lib/profilesCache';
import Avatar from '../../Feed/components/post/Avatar';
import { CameraIcon } from '../../../assets/icons/Icons';
import './ProfileSetup.css';

export default function ProfileSetup({ onComplete, submitLabel = 'Продолжить' }) {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      setUser(user);

      const fallback = user.email ? user.email.split('@')[0] : 'user';

      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          if (data) {
            setAvatarUrl(data.avatar_url || null);
            setUsername(data.username || fallback);
            setDisplayName(data.display_name || data.username || fallback);
          } else {
            setUsername(fallback);
            setDisplayName(fallback);
          }
        });
    });

    return () => { cancelled = true; };
  }, []);

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 5 МБ)');
      return;
    }
    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '31536000', upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      setAvatarUrl(publicUrl);
      invalidateProfile(user.id);
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) return;

    const u = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const d = displayName.trim();

    if (u.length < 3) {
      setError('Юзернейм: минимум 3 символа (a-z, 0-9, _)');
      return;
    }
    if (!d) {
      setError('Введите имя');
      return;
    }

    setSaving(true);

    /* uniqueness check */
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', u)
      .neq('id', user.id)
      .maybeSingle();

    if (existing) {
      setError('Этот юзернейм уже занят');
      setSaving(false);
      return;
    }

    const { error: saveErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: u,
        display_name: d,
        avatar_url: avatarUrl,
        email: user.email,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (saveErr) {
      setError(saveErr.message);
      return;
    }

    invalidateProfile(user.id);
    onComplete?.();
  };

  const previewName = displayName || username || 'user';
  const previewUsername = username || '';
  const isSubmitDisabled = saving || !displayName.trim() || username.trim().length < 3;

  return (
    <form className="profile-setup" onSubmit={handleSubmit}>
      <div className="profile-setup-preview">
        <div className="profile-setup-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="profile-setup-avatar-img" />
          ) : (
            <Avatar url={null} name={previewName} seed={user?.id} size={96} />
          )}
          <button
            type="button"
            className="profile-setup-avatar-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Сменить аватар"
          >
            {uploading ? '…' : <CameraIcon size={16} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatar}
            style={{ display: 'none' }}
          />
        </div>
        <div className="profile-setup-preview-name">{previewName}</div>
        {previewUsername && (
          <div className="profile-setup-preview-username">@{previewUsername}</div>
        )}
      </div>

      <label className="profile-setup-field">
        <span className="profile-setup-label">Имя</span>
        <input
          type="text"
          className="profile-setup-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Как вас зовут"
          maxLength={40}
          required
        />
      </label>

      <label className="profile-setup-field">
        <span className="profile-setup-label">Юзернейм</span>
        <div className="profile-setup-username-wrap">
          <span className="profile-setup-at">@</span>
          <input
            type="text"
            className="profile-setup-input profile-setup-input-username"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            placeholder="username"
            maxLength={30}
            required
          />
        </div>
      </label>

      {error && <div className="profile-setup-error">{error}</div>}

      <button
        type="submit"
        className="profile-setup-submit"
        disabled={isSubmitDisabled}
      >
        {saving ? '…' : submitLabel}
      </button>
    </form>
  );
}