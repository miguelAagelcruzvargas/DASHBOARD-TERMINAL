import { Navigate, Route, Routes } from 'react-router-dom';
import TerminalSystemPage from '../pages/TerminalSystemPage';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pos" replace />} />
      <Route path="/login" element={<TerminalSystemPage />} />
      <Route path="/pos" element={<TerminalSystemPage />} />
      <Route path="/ventas" element={<TerminalSystemPage />} />
      <Route path="/chofer" element={<TerminalSystemPage />} />
      <Route path="/admin" element={<TerminalSystemPage />} />
      <Route path="*" element={<Navigate to="/pos" replace />} />
    </Routes>
  );
}
