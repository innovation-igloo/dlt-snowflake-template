import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import SideNav from './components/SideNav';
import Pager from './components/Pager';
import Footer from './components/Footer';

export default function App() {
  const { pathname } = useLocation();

  // Scroll to top on every route change so each page opens at its heading.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return (
    <div className="shell">
      <SideNav />
      <div className="content">
        <Outlet />
        <div className="wrap">
          <Pager />
        </div>
        <Footer />
      </div>
    </div>
  );
}
