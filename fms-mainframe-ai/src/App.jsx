import { useState } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Droplets, 
  Truck, 
  PieChart, 
  Settings, 
  LogOut,
  MonitorPlay,
  HardDriveDownload,
  Factory,
  FileText,
  LineChart // NEW ICON FOR FORECASTER
} from 'lucide-react';

// Imports for your modules
import Login from './components/shared/Login';
import SettingsModule from './modules/Settings';
import DashboardModule from './modules/Dashboard';
import ProductionModule from './modules/Production';
import EconomicsModule from './modules/Economics';
import Logistics from './modules/Logistics';
import SystemEcosystem from './modules/SystemEcosystem';
import Backups from './modules/Backups'; 
import ProcessingModule from './modules/Processing';
import DocumentsModule from './modules/Documents'; 
import ForecasterModule from './modules/Forecaster'; // NEW MODULE IMPORT

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <Login onLogin={setIsAuthenticated} />;
  }

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive 
        ? 'bg-blue-600 text-white shadow-md' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
    }`;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex overflow-hidden">
        {/* Mainframe Sidebar */}
        <div className="w-72 bg-slate-900 text-white p-4 flex flex-col shadow-2xl z-10">
          <div className="mb-8 px-4 py-2 border-b border-slate-700">
            <h2 className="text-2xl font-bold text-blue-400 tracking-wider">FMS</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Mainframe v1.0</p>
          </div>
          
          <nav className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <ul className="space-y-2">
              <li>
                <NavLink to="/" className={navLinkClass}>
                  <LayoutDashboard size={20} />
                  <span className="font-medium">Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/production" className={navLinkClass}>
                  <Droplets size={20} />
                  <span className="font-medium">Production & Herd</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/processing" className={navLinkClass}>
                  <Factory size={20} />
                  <span className="font-medium">Processing & R&D</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/logistics" className={navLinkClass}>
                  <Truck size={20} />
                  <span className="font-medium">Logistics & Customers</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/economics" className={navLinkClass}>
                  <PieChart size={20} />
                  <span className="font-medium">Economic Analysis</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/forecaster" className={navLinkClass}>
                  <LineChart size={20} />
                  <span className="font-medium">Forecaster</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/documents" className={navLinkClass}>
                  <FileText size={20} />
                  <span className="font-medium">Documents & Invoices</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/system" className={navLinkClass}>
                  <MonitorPlay size={20} />
                  <span className="font-medium">App Ecosystem</span>
                </NavLink>
              </li>
            </ul>
          </nav>

          {/* Bottom Settings & Backups */}
          <div className="border-t border-slate-800 pt-4 mt-auto space-y-2">
            <NavLink to="/backups" className={navLinkClass}>
              <HardDriveDownload size={20} />
              <span className="font-medium">Data & Sync</span>
            </NavLink>

            <NavLink to="/settings" className={navLinkClass}>
              <Settings size={20} />
              <span className="font-medium">System Settings</span>
            </NavLink>
            
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors mt-2"
            >
              <LogOut size={20} />
              <span className="font-medium">Terminate Session</span>
            </button>
          </div>
        </div>

        {/* Content Injection Area */}
        <div className="flex-1 overflow-auto bg-slate-50">
          <Routes>
            <Route path="/" element={<DashboardModule />} />
            <Route path="/production" element={<ProductionModule />} />
            <Route path="/processing" element={<ProcessingModule />} />
            <Route path="/logistics" element={<Logistics />} />
            <Route path="/economics" element={<EconomicsModule />} />
            <Route path="/forecaster" element={<ForecasterModule />} />
            <Route path="/documents" element={<DocumentsModule />} />
            <Route path="/system" element={<SystemEcosystem />} />
            <Route path="/backups" element={<Backups />} />
            <Route path="/settings" element={<SettingsModule />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;