import { Routes, Route, NavLink } from 'react-router-dom'
import { Lightbulb, Search as SearchIcon, PenTool, Send, History, Settings } from 'lucide-react'
import IdeationPage from './pages/IdeationPage'
import ResearchPage from './pages/ResearchPage'
import AuthoringPage from './pages/AuthoringPage'
import PublishingPage from './pages/PublishingPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'

const navItems = [
  { to: '/', icon: Lightbulb, label: 'Ideation' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function App() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <nav className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-cyan-400">SciFi Poster</h1>
          <p className="text-xs text-slate-400">LinkedIn Post Generator</p>
        </div>
        <div className="flex-1 py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 border-r-2 border-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          Powered by Claude AI
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<IdeationPage />} />
          <Route path="/research/:postId" element={<ResearchPage />} />
          <Route path="/author/:postId" element={<AuthoringPage />} />
          <Route path="/publish/:postId" element={<PublishingPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
