import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-navy">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
