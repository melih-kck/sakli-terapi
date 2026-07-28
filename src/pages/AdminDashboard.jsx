import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/pages/Dashboard.css';
import {
  approvePsychologist,
  getAdminAuditLog,
  getApprovedPsychologistsForAdmin,
  getInactivePsychologistsForAdmin,
  getPendingPsychologists,
  getVerificationDocumentUrl,
  rejectPsychologist,
  resetDemoAdminData,
  reviewVerificationDocument,
  suspendPsychologist,
} from '../lib/admin';
import { IS_DEMO_MODE } from '../config/runtime';

const formatDate = (value, locale, withTime = false) => new Intl.DateTimeFormat(locale, withTime ? {
  dateStyle: 'short',
  timeStyle: 'short',
} : {
  dateStyle: 'short',
}).format(new Date(value));

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { success, error: showError } = useToast();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const locale = language === 'en' ? 'en-US' : 'tr-TR';

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

  const handleApprove = async (psychologist) => {
    const { id, display_name: name, verification_documents: documents = [] } = psychologist;
    if (!documents.some(document => document.status === 'approved')) {
      showError('Belge Onayı Gerekli', 'Profili etkinleştirmeden önce en az bir mesleki belgeyi onaylayın.');
      return;
    }
    if (!window.confirm(`${name} adlı psikoloğu onaylamak istediğinize emin misiniz?`)) return;
    await runStatusUpdate(
      id,
      () => approvePsychologist(id),
      'Onaylandı',
      `${name} artık platformda aktif.`,
    );
  };

  const handleDocumentView = async (document) => {
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    setProcessingId(`document-view-${document.id}`);
    try {
      const signedUrl = await getVerificationDocumentUrl(document.storage_path);
      if (previewWindow) previewWindow.location.href = signedUrl;
      else window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      previewWindow?.close();
      console.error('Mesleki belge açılamadı:', error);
      showError('Belge Açılamadı', 'Güvenli belge bağlantısı oluşturulamadı.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDocumentReview = async (document, psychologistName, status) => {
    let reason = null;
    if (status === 'approved') {
      if (!window.confirm(`${document.original_name} adlı belgeyi onaylamak istediğinize emin misiniz?`)) return;
    } else {
      reason = window.prompt(`${psychologistName} için belge ret nedenini yazın:`);
      if (reason === null) return;
      if (reason.trim().length < 5) {
        showError('Neden Gerekli', 'Lütfen en az 5 karakterlik açıklayıcı bir neden yazın.');
        return;
      }
      reason = reason.trim();
    }

    await runStatusUpdate(
      `document-review-${document.id}`,
      () => reviewVerificationDocument(document.id, status, reason),
      status === 'approved' ? 'Belge Onaylandı' : 'Belge Reddedildi',
      `${document.original_name} adlı belgenin durumu güncellendi.`,
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

  const handleDemoReset = async () => {
    if (!window.confirm('Kurgusal yönetici verilerini başlangıç durumuna döndürmek istiyor musunuz?')) return;
    resetDemoAdminData();
    success('Demo Sıfırlandı', 'Başvuru ve işlem geçmişi başlangıç durumuna döndürüldü.');
    await loadData();
  };

  if (!user || user.role !== 'admin') return null;

  const renderVerificationDocuments = (psychologist) => {
    const documents = psychologist.verification_documents || [];
    const pendingCount = documents.filter(document => document.status === 'pending').length;

    if (documents.length === 0) return <span className="admin-no-documents">{t('admin.noDocuments')}</span>;

    return (
      <details className="admin-document-review">
        <summary>
          {t('admin.documentCount', { count: documents.length })}
          {pendingCount > 0 && <span className="badge badge-warning">{t('admin.newCount', { count: pendingCount })}</span>}
        </summary>
        <div className="admin-document-list">
          {documents.map(document => (
            <div className="admin-document-row" key={document.id}>
              <div>
                <strong>{t(`admin.documentTypes.${document.document_type}`) || t('admin.professionalDocument')}</strong>
                <span title={document.original_name}>{document.original_name}</span>
                {document.review_reason && <small>{document.review_reason}</small>}
              </div>
              <span className={`badge verification-status is-${document.status}`}>
                {t(`admin.documentStatuses.${document.status}`) || document.status}
              </span>
              <div className="admin-document-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={processingId === `document-view-${document.id}`}
                  onClick={() => handleDocumentView(document)}
                >
                  {t('admin.view')}
                </button>
                {document.status !== 'approved' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={processingId === `document-review-${document.id}`}
                    onClick={() => handleDocumentReview(document, psychologist.display_name, 'approved')}
                  >
                    {t('admin.approve')}
                  </button>
                )}
                {document.status !== 'rejected' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm text-danger"
                    disabled={processingId === `document-review-${document.id}`}
                    onClick={() => handleDocumentReview(document, psychologist.display_name, 'rejected')}
                  >
                    {t('admin.reject')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </details>
    );
  };

  const renderPsychologistRows = (list, mode) => list.map((psychologist) => (
    <tr key={psychologist.id}>
      <td className="p-md text-sm text-secondary">{formatDate(psychologist.created_at, locale)}</td>
      <td className="p-md font-semibold">{psychologist.display_name || t('admin.unnamed')}</td>
      <td className="p-md text-sm">{psychologist.email}</td>
      <td className="p-md admin-documents-cell">{renderVerificationDocuments(psychologist)}</td>
      <td className="p-md">
        {mode === 'pending' ? (
          <>{psychologist.title} <span className="text-secondary">({psychologist.experience} {t('admin.year')})</span></>
        ) : (
          <>
            <span className={`badge ${psychologist.approval_status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
              {t(`admin.statusLabels.${psychologist.approval_status}`)}
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
                {t('admin.reject')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={processingId === psychologist.id || !psychologist.verification_documents?.some(document => document.status === 'approved')}
                title={psychologist.verification_documents?.some(document => document.status === 'approved') ? t('admin.approveTitle') : t('admin.approveDocumentFirst')}
                onClick={() => handleApprove(psychologist)}
              >
                {t('admin.approve')}
              </button>
            </>
          )}
          {mode === 'approved' && (
            <button type="button" className="btn btn-outline btn-sm admin-danger-action" disabled={processingId === psychologist.id} onClick={() => handleReasonedAction(psychologist.id, psychologist.display_name, 'suspend')}>
              {t('admin.suspend')}
            </button>
          )}
          {mode === 'inactive' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={processingId === psychologist.id || !psychologist.verification_documents?.some(document => document.status === 'approved')}
              title={psychologist.verification_documents?.some(document => document.status === 'approved') ? t('admin.reactivateTitle') : t('admin.approveDocumentFirst')}
              onClick={() => handleApprove(psychologist)}
            >
              {t('admin.reactivate')}
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
              <h1 className="dash-title">{t('admin.title')}</h1>
              <p className="dash-subtitle">
                {IS_DEMO_MODE
                  ? t('admin.demoSubtitle')
                  : t('admin.liveSubtitle')}
              </p>
            </div>
            {IS_DEMO_MODE && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleDemoReset}>
                {t('admin.reset')}
              </button>
            )}
          </div>

          <div className="grid grid-3 gap-md mb-2xl">
            <div className="dash-stat-card">
              <span className="dash-stat-value">{approvedList.length}</span>
              <span className="dash-stat-label">{t('admin.activePsychologists')}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-value">{pendingList.length}</span>
              <span className="dash-stat-label">{t('admin.pendingApproval')}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-value">{inactiveList.length}</span>
              <span className="dash-stat-label">{t('admin.inactiveAccounts')}</span>
            </div>
          </div>

          <div className="admin-workspace">
            <div className="tab-navigation admin-tabs" role="tablist" aria-label={t('admin.tabsLabel')}>
              <button type="button" role="tab" aria-selected={activeTab === 'pending'} className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                {t('admin.pending')} {pendingList.length > 0 && <span className="badge badge-warning">{pendingList.length}</span>}
              </button>
              <button type="button" role="tab" aria-selected={activeTab === 'approved'} className={`tab-item ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>
                {t('admin.active')}
              </button>
              <button type="button" role="tab" aria-selected={activeTab === 'inactive'} className={`tab-item ${activeTab === 'inactive' ? 'active' : ''}`} onClick={() => setActiveTab('inactive')}>
                {t('admin.inactive')}
              </button>
              <button type="button" role="tab" aria-selected={activeTab === 'audit'} className={`tab-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
                {t('admin.audit')}
              </button>
            </div>

            {isLoading ? (
              <div className="admin-empty-state">{t('admin.loading')}</div>
            ) : activeTab === 'audit' ? (
              auditLog.length === 0 ? (
                <div className="admin-empty-state">{t('admin.noAudit')}</div>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr><th>{t('admin.date')}</th><th>{t('admin.psychologist')}</th><th>{t('admin.action')}</th><th>{t('admin.reason')}</th></tr>
                    </thead>
                    <tbody>
                      {auditLog.map((entry) => (
                        <tr key={entry.id}>
                          <td>{formatDate(entry.created_at, locale, true)}</td>
                          <td>{entry.metadata?.display_name || t('admin.deletedAccount')}</td>
                          <td>{t(`admin.actionLabels.${entry.action}`) || entry.action}</td>
                          <td>{entry.metadata?.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeList.length === 0 ? (
              <div className="admin-empty-state">{t('admin.noRecords')}</div>
            ) : (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.registered')}</th>
                      <th>{t('admin.fullName')}</th>
                      <th>{t('admin.email')}</th>
                      <th>{t('admin.documents')}</th>
                      <th>{t('admin.status')}</th>
                      <th>{t('admin.action')}</th>
                    </tr>
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
