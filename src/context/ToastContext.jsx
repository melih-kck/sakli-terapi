/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = crypto.randomUUID();
    const newToast = { id, duration: 4000, ...toast };
    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, newToast.duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((title, message) => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((title, message) => addToast({ type: 'error', title, message }), [addToast]);
  const warning = useCallback((title, message) => addToast({ type: 'warning', title, message }), [addToast]);
  const info = useCallback((title, message) => addToast({ type: 'info', title, message }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="toast-container" style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 999999, display: 'flex', flexDirection: 'column', gap: '12px', pointerEvents: 'none' }}>
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`} style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: '#1e293b', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.8)', borderLeft: `4px solid ${toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#3b82f6'}`, minWidth: '320px', maxWidth: '480px' }}>
          <span className="toast-icon" style={{ fontSize: '24px' }}>{icons[toast.type]}</span>
          <div className="toast-content" style={{ flex: 1 }}>
            <div className="toast-title" style={{ fontWeight: 'bold', fontSize: '16px', color: '#ffffff' }}>{toast.title}</div>
            {toast.message && <div className="toast-message" style={{ fontSize: '14px', color: '#cbd5e1', marginTop: '4px', lineHeight: '1.4' }}>{toast.message}</div>}
          </div>
          <button className="toast-close" onClick={() => onRemove(toast.id)} style={{ color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
