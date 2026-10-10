import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { CameraIcon } from '../../../../assets/icons/Icons';
import Avatar from '../post/Avatar';
import './ProfileModal.css';

export default function ProfileModal({ user, onClose }) {
  const [profile, setProfile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [savingName, setSavingName] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        setUsername(data?.username || '');
      });
  }, [user]);

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

      const { error: dbErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() });
      if (dbErr) throw dbErr;

      setProfile((p) => ({ ...(p || {}), id: user.id, avatar_url: publicUrl }));
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveUsername = async () => {
    if (!username.trim()) return;
    setSavingName(true);
    await supabase
      .from('profiles')
      .upsert({ id: user.id, username: username.trim(), updated_at: new Date().toISOString() });
    setProfile((p) => ({ ...(p || {}), id: user.id, username: username.trim() }));
    setSavingName(false);
  };

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose}>✕</button>

        <div className="profile-avatar-wrap">
          <Avatar
            url={profile?.avatar_url}
            name={profile?.username || user.email}
            size={110}
          />
          <button
            className="profile-avatar-btn"
            onClick={() => fileRef.current.click()}
            disabled={uploading}
            aria-label="Сменить аватар"
          >
            {uploading ? '…' : <CameraIcon size={18} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatar}
            style={{ display: 'none' }}
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">Имя пользователя</label>
          <div className="profile-name-row">
            <input
              type="text"
              className="profile-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              maxLength={30}
            />
            <button
              className="profile-save"
              onClick={saveUsername}
              disabled={savingName || !username.trim() || username === profile?.username}
            >
              {savingName ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>

        <div className="profile-field">
          <label className="profile-label">E-Mail</label>
          <div className="profile-email">{user.email}</div>
        </div>
      </div>
    </div>
  );
}