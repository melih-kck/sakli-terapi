import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setIsMobileOpen(false));
    return () => cancelAnimationFrame(frameId);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const dashboardPath = user?.role === 'admin'
    ? '/admin'
    : user?.role === 'psychologist'
      ? '/psikolog-panel'
      : '/panel';
  const dashboardLabel = user?.role === 'admin'
    ? 'Admin Paneli'
    : user?.role === 'psychologist'
      ? 'Psikolog Paneli'
      : 'Panelim';

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`} id="main-navbar">
      <div className="container navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo" id="navbar-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" fill="url(#logoGrad)" />
              <path d="M16 8C11.58 8 8 11.58 8 16s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 2.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5-2.5-1.12-2.5-2.5 1.12-2.5 2.5-2.5zm0 11.5c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z" fill="white" opacity="0.9"/>
              <circle cx="16" cy="13" r="3" fill="white" opacity="0.3"/>
              <defs>
                <linearGradient id="logoGrad" x1="2" y1="2" x2="30" y2="30">
                  <stop stopColor="#4A3AFF" />
                  <stop offset="1" stopColor="#7B68EE" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text">
            Gizli<span className="logo-highlight">Biriz</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className={`navbar-links ${isMobileOpen ? 'open' : ''}`}>
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`} id="nav-home">
            Ana Sayfa
          </Link>
          <Link to="/psikologlar" className={`nav-link ${isActive('/psikologlar') ? 'active' : ''}`} id="nav-psychologists">
            Psikologlar
          </Link>
          <Link to="/hakkinda" className={`nav-link ${isActive('/hakkinda') ? 'active' : ''}`} id="nav-about">
            Hakkında
          </Link>

          {isAuthenticated && (
            <Link to={dashboardPath} className={`nav-link ${isActive(dashboardPath) ? 'active' : ''}`} id="nav-dashboard">
              {dashboardLabel}
            </Link>
          )}

          {/* Mobile Auth Buttons */}
          <div className="navbar-auth-mobile">
            {isAuthenticated ? (
              <>
                <Link to={dashboardPath} className="nav-link" onClick={() => setIsMobileOpen(false)}>
                  {dashboardLabel}
                </Link>
                <Link to="/ayarlar" className="nav-link" onClick={() => setIsMobileOpen(false)}>Ayarlar</Link>
                <button onClick={() => { handleLogout(); setIsMobileOpen(false); }} className="btn btn-outline" style={{ width: '100%' }}>Çıkış Yap</button>
              </>
            ) : (
              <>
                <Link to="/giris" className="btn btn-ghost btn-sm" id="nav-mobile-login">Giriş Yap</Link>
                <Link to="/kayit" className="btn btn-primary btn-sm" id="nav-mobile-register">Ücretsiz Başla</Link>
              </>
            )}
          </div>
        </div>

        {/* Desktop Auth */}
        <div className="navbar-auth">
          {isAuthenticated ? (
            <div className="navbar-user flex items-center gap-md">
              <Link to={dashboardPath} className="btn btn-outline btn-sm">
                {dashboardLabel}
              </Link>
              <button onClick={handleLogout} className="btn btn-text btn-sm text-secondary">
                Çıkış Yap
              </button>
            </div>
          ) : (
            <>
              <Link to="/giris" className="btn btn-ghost" id="nav-login">Giriş Yap</Link>
              <Link to="/kayit" className="btn btn-primary" id="nav-register">Ücretsiz Başla</Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className={`navbar-hamburger ${isMobileOpen ? 'open' : ''}`}
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          id="nav-hamburger"
          aria-label="Menü"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && <div className="navbar-overlay" onClick={() => setIsMobileOpen(false)} />}
    </nav>
  );
}
