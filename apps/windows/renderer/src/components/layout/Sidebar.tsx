import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MonitorSmartphone, FolderSync, MessageSquare, Globe, Settings } from 'lucide-react';
import Logo from '../ui/Logo';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/devices', label: 'Devices', icon: MonitorSmartphone },
  { path: '/files', label: 'Files', icon: FolderSync },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/social', label: 'Social', icon: Globe },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-panel border-r-4 border-ink flex flex-col h-full z-20">
      <div className="p-6 border-b-4 border-ink">
        <Logo />
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-none font-bold uppercase transition-all border-2 ${
                isActive
                  ? 'bg-accent-yellow text-ink border-ink comic-shadow translate-x-1'
                  : 'bg-transparent text-text-muted border-transparent hover:bg-ink hover:text-text hover:border-border'
              }`
            }
          >
            <item.icon className="w-5 h-5" strokeWidth={2.5} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t-4 border-ink text-xs text-text-muted text-center font-bold uppercase">
        ComicLink v0.1.0
      </div>
    </aside>
  );
}
