import { Link, Route, Routes } from 'react-router';
import { DesignSystemPage } from './design-system-page';
import { ShellPage } from './shell-page';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ShellPage />} />
      <Route path="/app-shell" element={<ShellPage review />} />
      <Route path="/design-system" element={<DesignSystemPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
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
