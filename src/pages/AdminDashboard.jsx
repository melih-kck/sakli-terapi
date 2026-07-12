import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/pages/Dashboard.css';
import {
  approvePsychologist,
  getAdminAuditLog,
  getApprovedPsychologistsForAdmin,
  getInactivePsychologistsForAdmin,
  getPendingPsychologists,
  rejectPsychologist,
  suspendPsychologist,
} from '../lib/admin';

const statusLabels = {
  approved: 'Aktif',
  rejected: 'Reddedildi',
  suspended: 'Askıda',
};

const actionLabels = {
  psychologist_approved: 'Onaylandı',
  psychologist_rejected: 'Reddedildi',
  psychologist_suspended: 'Askıya alındı',
};

const formatDate = (value, withTime = false) => new Intl.DateTimeFormat('tr-TR', withTime ? {
  dateStyle: 'short',
  timeStyle: 'short',
} : {
  dateStyle: 'short',
}).format(new Date(value));

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('pending');
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [inactiveList, setInactiveList] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/giris');
    } else if (user?.role !== 'admin') {
      navigate('/');
      showError('Yetkisiz Erişim', 'Bu sayfayı görüntüleme yetkiniz yok.');
    }
  }, [isAuthenticated, user, navigate, showError]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pending, approved, inactive, history] = await Promise.all([
        getPendingPsychologists(),
        getApprovedPsychologistsForAdmin(),
        getInactivePsychologistsForAdmin(),
        getAdminAuditLog(),
      ]);
      setPendingList(pending);
      setApprovedList(approved);
      setInactiveList(inactive);
      setAuditLog(history);
    } catch (error) {
      console.error('Admin verileri yüklenirken hata:', error);
      showError('Veriler Yüklenemedi', 'Yönetim verileri şu anda alınamıyor.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (user?.role === 'admin') Promise.resolve().then(loadData);
  }, [user?.role, loadData]);

  const runStatusUpdate = async (id, operation, successTitle, successMessage) => {
    setProcessingId(id);
    const result = await operation();
    setProcessingId(null);

    if (!result.success) {
      showError('İşlem Tamamlanamadı', result.error);
      return;
    }

    success(successTitle, successMessage);
    await loadData();
  };

  const handleApprove = async (id, name) => {
    if (!window.confirm(`${name} adlı psikoloğu onaylamak istediğinize emin misiniz?`)) return;
    await runStatusUpdate(
      id,
      () => approvePsychologist(id),
      'Onaylandı',
      `${name} artık platformda aktif.`,
    );
  };

  const handleReasonedAction = async (id, name, mode) => {
    const isSuspension = mode === 'suspend';
    const reason = window.prompt(
      `${name} için ${isSuspension ? 'askıya alma' : 'ret'} nedenini yazın:`,
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      showError('Neden Gerekli', 'Lütfen en az 5 karakterlik açıklayıcı bir neden yazın.');
      return;
    }

    await runStatusUpdate(
      id,
      () => (isSuspension
        ? suspendPsychologist(id, reason.trim())
        : rejectPsychologist(id, reason.trim())),
      isSuspension ? 'Askıya Alındı' : 'Reddedildi',
      `${name} adlı hesabın durumu güncellendi.`,
    );
  };

  if (!user || user.role !== 'admin') return null;

  const renderPsychologistRows = (list, mode) => list.map((psychologist) => (
    <tr key={psychologist.id}>
      <td className="p-md text-sm text-secondary">{formatDate(psychologist.created_at)}</td>
      <td className="p-md font-semibold">{psychologist.display_name || 'İsimsiz'}</td>
      <td className="p-md text-sm">{psychologist.email}</td>
      <td className="p-md">
        {mode === 'pending' ? (
          <>{psychologist.title} <span className="text-secondary">({psychologist.experience} yıl)</span></>
        ) : (
          <>
            <span className={`badge ${psychologist.approval_status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
              {statusLabels[psychologist.approval_status]}
            </span>
            {psychologist.review_reason && <div className="admin-review-reason">{psychologist.review_reason}</div>}
          </>
        )}
      </td>
      <td className="p-md text-right">
        <div className="admin-row-actions">
          {mode === 'pending' && (
            <>
              <button type="button" className="btn btn-outline btn-sm" disabled={processingId === psychologist.id} onClick={() => handleReasonedAction(psychologist.id, psychologist.display_name, 'reject')}>
                Reddet
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={processingId === psychologist.id} onClick={() => handleApprove(psychologist.id, psychologist.display_name)}>
                Onayla
              </button>
            </>
          )}
          {mode === 'approved' && (
            <button type="button" className="btn btn-outline btn-sm admin-danger-action" disabled={processingId === psychologist.id} onClick={() => handleReasonedAction(psychologist.id, psychologist.display_name, 'suspend')}>
              Askıya Al
            </button>
          )}
          {mode === 'inactive' && (
            <button type="button" className="btn btn-outline btn-sm" disabled={processingId === psychologist.id} onClick={() => handleApprove(psychologist.id, psychologist.display_name)}>
              Yeniden Etkinleştir
            </button>
          )}
        </div>
      </td>
    </tr>
  ));

  const activeList = activeTab === 'pending'
    ? pendingList
    : activeTab === 'approved'
      ? approvedList
      : inactiveList;

  return (
    <div className="page">
      <Navbar />
      <main className="page-content admin-page">
        <div className="container mt-xl">
          <div className="dash-header mb-2xl">
            <div>
              <h1 className="dash-title">Yönetici Paneli</h1>
              <p className="dash-subtitle">Psikolog başvuruları ve yönetici işlem geçmişi</p>
            </div>
          </div>

          <div className="grid grid-3 gap-md mb-2xl">
            <div className="dash-stat-card">
              <span className="dash-stat-value">{approvedList.length}</span>
              <span className="dash-stat-label">Aktif Psikolog</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-value">{pendingList.length}</span>
              <span className="dash-stat-label">Onay Bekleyen</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-value">{inactiveList.length}</span>
              <span className="dash-stat-label">Pasif Hesap</span>
            </div>
          </div>

          <div className="admin-workspace">
            <div className="tab-navigation admin-tabs">
              <button type="button" className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                Bekleyenler {pendingList.length > 0 && <span className="badge badge-warning">{pendingList.length}</span>}
              </button>
              <button type="button" className={`tab-item ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>
                Aktif
              </button>
              <button type="button" className={`tab-item ${activeTab === 'inactive' ? 'active' : ''}`} onClick={() => setActiveTab('inactive')}>
                Pasif
              </button>
              <button type="button" className={`tab-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                İşlem Geçmişi
              </button>
            </div>

            {isLoading ? (
              <div className="admin-empty-state">Veriler yükleniyor...</div>
            ) : activeTab === 'audit' ? (
              auditLog.length === 0 ? (
                <div className="admin-empty-state">Henüz yönetici işlemi bulunmuyor.</div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Tarih</th><th>Psikolog</th><th>İşlem</th><th>Neden</th></tr>
                    </thead>
                    <tbody>
                      {auditLog.map((entry) => (
                        <tr key={entry.id}>
                          <td>{formatDate(entry.created_at, true)}</td>
                          <td>{entry.metadata?.display_name || 'Silinmiş hesap'}</td>
                          <td>{actionLabels[entry.action] || entry.action}</td>
                          <td>{entry.metadata?.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeList.length === 0 ? (
              <div className="admin-empty-state">Bu bölümde kayıt bulunmuyor.</div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr><th>Kayıt Tarihi</th><th>Ad Soyad</th><th>E-posta</th><th>Durum</th><th>İşlem</th></tr>
                  </thead>
                  <tbody>{renderPsychologistRows(activeList, activeTab)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
