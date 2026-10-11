// Кэш профилей, чтобы не тянуть один и тот же профиль десятки раз
const cache = new Map();
const pending = new Map();

export async function getProfile(supabase, userId) {
  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId);
  if (pending.has(userId)) return pending.get(userId);

  const promise = supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data }) => {
      if (data) cache.set(userId, data);
      pending.delete(userId);
      return data;
    })
    .catch(() => {
      pending.delete(userId);
      return null;
    });

  pending.set(userId, promise);
  return promise;
}

// Сбрасываем кэш, когда пользователь сохраняет новый ник/аватар
export function invalidateProfile(userId) {
  if (!userId) return;
  cache.delete(userId);
}