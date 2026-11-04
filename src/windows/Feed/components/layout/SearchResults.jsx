import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useT } from '../../../../lib/i18n';
import { supabase } from '../../../../lib/supabaseClient';
import { fuzzySearch, normalize } from '../../../../lib/fuzzySearch';
import { SearchIcon } from '../../../../assets/icons/Icons';
import PostCard from '../post/PostCard';
import './Sheet.css';

const CORPUS_SIZE = 500; // последние посты, по которым ищем с опечатками
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/*
 * Живой умный поиск: обновляется на каждый символ, находит слова с опечатками,
 * по началу слова и в неправильной раскладке. Последние 500 постов ищутся
 * на месте мгновенно; более старые — точным поиском в базе.
 */
export default function SearchResults({ query, currentUser, readOnly = false, onRequireAuth, onOpenPost, onOpenProfile }) {
  const t = useT();
  const [corpus, setCorpus] = useState(null);
  const [older, setOlder] = useState([]);
  const reqRef = useRef(0);
  const q = query.trim();

  // посты для поиска загружаем один раз при открытии поиска
  useEffect(() => {
    let alive = true;
    supabase
      .from('repositories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(CORPUS_SIZE)
      .then(({ data }) => { if (alive) setCorpus(data || []); });
    return () => { alive = false; };
  }, []);

  // если постов больше 500 — по старым ищем точно на сервере
  useEffect(() => {
    const id = ++reqRef.current;
    setOlder([]);
    if (!q || !corpus || corpus.length < CORPUS_SIZE) return undefined;
    const oldest = corpus[corpus.length - 1]?.created_at;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('repositories')
        .select('*')
        .lt('created_at', oldest)
        .ilike('name', `%${escapeLike(q)}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (id === reqRef.current) setOlder(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, corpus]);

  const results = useMemo(() => {
    if (!corpus || !normalize(q)) return [];
    const found = fuzzySearch(corpus, q);
    const seen = new Set(found.map((r) => r.post.id));
    const extra = older.filter((p) => !seen.has(p.id)).map((post) => ({ post, score: 0, terms: [q] }));
    return [...found, ...extra];
  }, [corpus, older, q]);

  if (!q) {
    return (
      <div className="sheet-empty">
        <div className="sheet-empty-icon"><SearchIcon size={48} /></div>
        <div className="sheet-empty-text">{t('search.hint')}</div>
      </div>
    );
  }

  if (!corpus) {
    return <div className="sheet-empty"><div className="sheet-empty-text">{t('search.loading')}</div></div>;
  }

  if (results.length === 0) {
    return (
      <div className="sheet-empty">
        <div className="sheet-empty-title">{t('search.none')}</div>
        <div className="sheet-empty-text">{t('search.tryOther')}</div>
      </div>
    );
  }

  return (
    <div className="search-results">
      {results.map(({ post, terms }) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          readOnly={readOnly}
          onRequireAuth={onRequireAuth}
          onOpen={onOpenPost}
          onOpenProfile={onOpenProfile}
          highlight={terms}
        />
      ))}
    </div>
  );
}
