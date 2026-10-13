import { Link, Route, Routes } from 'react-router';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function HomePage() {
  return (
    <main className="page">
      <section className="message">
        <h1>급지도</h1>
        <p>지도를 준비하고 있어요.</p>
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page">
      <section className="message">
        <h1>페이지를 찾을 수 없어요</h1>
        <p>주소를 확인하거나 홈으로 돌아가 주세요.</p>
        <Link to="/">홈으로 돌아가기</Link>
      </section>
    </main>
  );
}
