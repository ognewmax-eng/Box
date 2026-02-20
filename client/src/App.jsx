import { Routes, Route } from 'react-router-dom';
import Host from './pages/Host';
import Client from './pages/Client';
import Admin from './pages/Admin';
import Home from './pages/Home';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host" element={<Host />} />
      <Route path="/client" element={<Client />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
