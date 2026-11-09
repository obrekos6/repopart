// Только показывает кнопки. Настоящие права проверяет база (supabase/admin.sql).
export const ADMIN_EMAIL = 'obrekos6@gmail.com';

export const isAdmin = (user) => user?.email === ADMIN_EMAIL;
