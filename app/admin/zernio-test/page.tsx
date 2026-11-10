'use client';

import { useState } from 'react';

export default function ZernioTestPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function sendTest() {
    if (busy || !window.confirm('Опубликовать один тестовый пост в открытом Threads-аккаунте @zumer_courier?')) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/admin/zernio-preview-test-post', { method: 'POST' });
      const data = await response.json();
      setResult({ ...data, status: response.status });
    } catch {
      setResult({ ok: false, error: 'Не удалось получить ответ. Не нажимайте повторно: результат отправки может быть неопределён.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Тест Zernio → Threads</h1>
      <p>Аккаунт: <strong>@zumer_courier</strong></p>
      <p>Будет опубликован один фиксированный тестовый пост. Повторная отправка заблокирована на 24 часа.</p>
      <button onClick={sendTest} disabled={busy} style={{ padding: '12px 18px', borderRadius: 8, border: 0, background: '#111', color: '#fff', opacity: busy ? .6 : 1 }}>
        {busy ? 'Отправляем…' : 'Опубликовать тестовый пост'}
      </button>
      {result && <section style={{ marginTop: 24, padding: 16, border: '1px solid #ccc', borderRadius: 8 }}>
        <strong>{result.ok ? 'Запрос принят' : 'Неуспешно'}</strong>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(result, null, 2)}</pre>
        {result.permalink && <a href={result.permalink} target="_blank" rel="noreferrer">Открыть публикацию в Threads</a>}
      </section>}
    </main>
  );
}
