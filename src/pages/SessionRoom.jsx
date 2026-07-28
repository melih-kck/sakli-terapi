import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { Peer } from 'peerjs';
import { getSessionJoinState } from '../lib/session-flow';
import {
  MAX_SESSION_MESSAGE_LENGTH,
  SESSION_CONNECTION_ATTEMPT_TIMEOUT_MS,
  isExpectedSessionPeer,
  normalizeIncomingSessionMessage,
  sanitizeSessionChatText,
  shouldRetrySessionConnection,
} from '../lib/session-connection';
import { acquireSessionMedia } from '../lib/session-media';
import {
  DEFAULT_SESSION_BLUR_LEVEL,
  getSessionBlurPreset,
  isSessionClearVideoLevel,
  normalizeSessionBlurLevel,
  SESSION_BLUR_PRESETS,
} from '../lib/session-privacy';
import { ALLOW_LOCAL_SIMULATION, IS_DEMO_MODE } from '../config/runtime';
import Navbar from '../components/Navbar';
import '../styles/pages/Session.css';

const drawCanvasNotice = (ctx, canvas, title, subtitle) => {
  ctx.filter = 'none';
  ctx.fillStyle = '#101715';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#bac5c0';
  ctx.font = '600 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = '#8f9f98';
  ctx.font = '18px Arial, sans-serif';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 28);
};

const createSilentAudioStream = () => {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;

  const audioContext = new AudioContextCtor();
  const source = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();

  gain.gain.value = 0;
  source.connect(gain).connect(destination);
  source.start();

  return { stream: destination.stream, audioContext, source };
};

export default function SessionRoom() {
  const { user, isClient } = useAuth();
  const {
    updateSession,
    sessions,
    isLoadingSessions,
    hasLoadedSessions,
    getSessionRoomAccess,
  } = useSession();
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine session channel immediately on render
  const currentSession = sessions?.find(s => String(s.id) === String(sessionId));
  const sessionChannel = currentSession?.channel || location.state?.channel || 'video-blur';
  const sessionAccess = getSessionJoinState(currentSession);
  const panelPath = user?.role === 'admin' ? '/admin' : isClient ? '/panel' : '/psikolog-panel';
  const isMockUser = ALLOW_LOCAL_SIMULATION && user?.id?.startsWith('mock-');
  const [roomAccess, setRoomAccess] = useState(null);
  const [roomAccessError, setRoomAccessError] = useState('');
  const [isLoadingRoomAccess, setIsLoadingRoomAccess] = useState(true);
  const shouldLoadRoomAccess = Boolean(user && currentSession && sessionAccess.canJoin);
  const isWaitingForSession = Boolean(
    user
    && (
      !hasLoadedSessions
      || isLoadingSessions
      || (shouldLoadRoomAccess && isLoadingRoomAccess)
    )
  );
  const isRoomIdentityMissing = Boolean(
    currentSession
    && sessionAccess.canJoin
    && !isLoadingRoomAccess
    && (!roomAccess?.myPeerId || !roomAccess?.targetPeerId)
  );
  const isAccessBlocked = user
    && !isWaitingForSession
    && (!currentSession || !sessionAccess.canJoin || isRoomIdentityMissing);
  const shouldUseBlurStream = isClient && sessionChannel === 'video-blur';
  const connectingStatusLabel = sessionChannel === 'text'
    ? 'Sohbet Bağlanıyor...'
    : sessionChannel === 'voice'
      ? 'Mikrofon Bağlanıyor...'
      : 'Kamera Bağlanıyor...';

  const initialBlurLevel = getSessionBlurPreset(
    user?.privacyLevel || DEFAULT_SESSION_BLUR_LEVEL,
  ).level;
  const [blurLevel, setBlurLevel] = useState(initialBlurLevel);
  const [blurSliderLevel, setBlurSliderLevel] = useState(initialBlurLevel);
  const [clearVideoConsent, setClearVideoConsent] = useState(false);
  const blurLevelRef = useRef(initialBlurLevel);
  const lastSafeBlurLevelRef = useRef(initialBlurLevel);
  const activeBlurPreset = getSessionBlurPreset(blurLevel);
  const showClearVideoConsent = isSessionClearVideoLevel(blurSliderLevel);
  
  const handleBlurChange = (val) => {
    const nextLevel = normalizeSessionBlurLevel(val);
    setBlurSliderLevel(nextLevel);

    if (isSessionClearVideoLevel(nextLevel)) {
      if (!isSessionClearVideoLevel(blurLevel)) {
        setClearVideoConsent(false);
      }
      return;
    }

    lastSafeBlurLevelRef.current = nextLevel;
    setClearVideoConsent(false);
    setBlurLevel(nextLevel);
    blurLevelRef.current = nextLevel;
  };

  const handleClearVideoConsent = (event) => {
    const isConfirmed = event.target.checked;
    setClearVideoConsent(isConfirmed);

    if (isConfirmed) {
      setBlurSliderLevel(0);
      setBlurLevel(0);
      blurLevelRef.current = 0;
      return;
    }

    const safeLevel = lastSafeBlurLevelRef.current || DEFAULT_SESSION_BLUR_LEVEL;
    setBlurSliderLevel(safeLevel);
    setBlurLevel(safeLevel);
    blurLevelRef.current = safeLevel;
  };
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Odaya bağlanılıyor...', sender: 'system', time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [chatInput, setChatInput] = useState('');
  
  const [sessionStatus, setSessionStatus] = useState('connecting'); // connecting, ready, active
  const [sessionTime, setSessionTime] = useState(0);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [remoteVideoMissing, setRemoteVideoMissing] = useState(false);
  const [microphoneAvailable, setMicrophoneAvailable] = useState(null);
  const [cameraAvailable, setCameraAvailable] = useState(null);
  const [remotePlaybackBlocked, setRemotePlaybackBlocked] = useState(false);
  
  const [pipMode, setPipMode] = useState('safe');
  const pipModeRef = useRef('safe');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const camOnRef = useRef(true);

  // Refs for WebRTC & Canvas
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const callRef = useRef(null);
  
  const localStreamRef = useRef(null); // Real camera stream
  const blurStreamRef = useRef(null);  // Processed canvas stream
  
  const hiddenVideoRef = useRef(null); // Used to draw to canvas
  const canvasRef = useRef(null);
  
  const remoteVideoRef = useRef(null); // Big screen (other person)
  const pipVideoRef = useRef(null);    // Small screen (me)

  const animationFrameId = useRef(null);
  const retryTimerRef = useRef(null);
  const connectionAttemptTimerRef = useRef(null);
  const demoResponseTimerRef = useRef(null);
  const fallbackAudioContextRef = useRef(null);
  const fallbackAudioNodeRef = useRef(null);
  const remotePlaybackNoticeShownRef = useRef(false);
  const remoteAudioMissingNoticeShownRef = useRef(false);
  const demoModeRef = useRef(false);
  const peerInitRetryRef = useRef(0);

  const closeFallbackAudio = useCallback(() => {
    try {
      fallbackAudioNodeRef.current?.stop?.();
    } catch {
      // The generated test source may already be stopped during cleanup.
    }

    const fallbackAudioContext = fallbackAudioContextRef.current;
    if (fallbackAudioContext && fallbackAudioContext.state !== 'closed') {
      void fallbackAudioContext.close().catch(() => {});
    }

    fallbackAudioContextRef.current = null;
    fallbackAudioNodeRef.current = null;
  }, []);

  const syncPipPreview = useCallback(() => {
    if (!pipVideoRef.current) return;
    const nextStream = pipModeRef.current === 'raw'
      ? localStreamRef.current
      : (blurStreamRef.current || localStreamRef.current);

    if (pipVideoRef.current.srcObject !== nextStream) {
      pipVideoRef.current.srcObject = nextStream || null;
    }
  }, []);

  const myPeerId = roomAccess?.myPeerId || null;
  const targetPeerId = roomAccess?.targetPeerId || null;
  const participantRole = isClient ? 'client' : 'psychologist';
  const expectedPeerRole = isClient ? 'psychologist' : 'client';

  // Draw loop for Canvas Blur
  const drawToCanvas = useCallback(function drawFrame() {
    if (!hiddenVideoRef.current || !canvasRef.current) return;
    const video = hiddenVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const videoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    const nextWidth = videoReady ? video.videoWidth : 1280;
    const nextHeight = videoReady ? video.videoHeight : 720;
    
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!camOnRef.current) {
      drawCanvasNotice(ctx, canvas, 'Kamera kapalı', 'Gizlilik modu aktif');
    } else if (!videoReady) {
      drawCanvasNotice(ctx, canvas, 'Kamera hazırlanıyor', 'Güvenli görüntü oluşturuluyor');
    } else {
      const pxBlur = getSessionBlurPreset(blurLevelRef.current).pixels;
      if (pxBlur === 0) {
        ctx.filter = 'none';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        const bleed = Math.ceil(pxBlur * 2);
        ctx.filter = `blur(${pxBlur}px)`;
        ctx.drawImage(video, -bleed, -bleed, canvas.width + bleed * 2, canvas.height + bleed * 2);
      }
      ctx.filter = 'none';
    }

    ctx.restore();

    animationFrameId.current = requestAnimationFrame(drawFrame);
  }, []);

  const addSystemMessage = useCallback((text) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), text, sender: 'system', time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})
    }]);
  }, []);

  const markRemoteUnavailable = useCallback((message = "Karşı taraf bağlantısı kesildi. Yeniden bağlanması bekleniyor...") => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemotePlaybackBlocked(false);
    setRemoteVideoReady(false);
    setRemoteVideoMissing(sessionChannel === 'video-blur');
    setSessionStatus('ready');
    addSystemMessage(message);
  }, [addSystemMessage, sessionChannel]);

  const handleDataConnection = useCallback((conn) => {
    connRef.current = conn;

    const markOpen = () => {
      addSystemMessage("Sohbet bağlantısı kuruldu.");
      if (sessionChannel === 'text') {
        setSessionStatus('active');
      }
    };

    if (conn.open) {
      markOpen();
    } else {
      conn.on('open', markOpen);
    }

    conn.on('data', (data) => {
      const message = normalizeIncomingSessionMessage(data, expectedPeerRole);
      if (message) {
        setMessages(prev => [...prev, message]);
      }
    });
  }, [addSystemMessage, expectedPeerRole, sessionChannel]);

  const attachRemoteStream = useCallback((remoteStream) => {
    const remoteElement = remoteVideoRef.current;
    if (!remoteElement) return;

    if (remoteElement.srcObject !== remoteStream) {
      remoteElement.srcObject = remoteStream;
    }
    remoteElement.muted = false;
    remoteElement.volume = 1;
    demoModeRef.current = false;

    const hasVideoTrack = remoteStream.getVideoTracks().length > 0;
    const hasAudioTrack = remoteStream.getAudioTracks().length > 0;
    setRemoteVideoMissing(sessionChannel === 'video-blur' && !hasVideoTrack);
    setRemoteVideoReady(sessionChannel !== 'video-blur');

    if (!hasAudioTrack && !remoteAudioMissingNoticeShownRef.current) {
      remoteAudioMissingNoticeShownRef.current = true;
      addSystemMessage('Karşı tarafın mikrofon akışı alınamadı. Karşı taraf mikrofon iznini kontrol etmeli.');
    }

    remoteStream.getVideoTracks().forEach((track) => {
      track.onended = () => markRemoteUnavailable("Karşı tarafın kamera bağlantısı kapandı. Yeniden bağlanması bekleniyor...");
      track.onmute = () => setRemoteVideoReady(false);
      track.onunmute = () => setRemoteVideoReady(true);
    });

    void remoteElement.play?.()
      .then(() => {
        setRemotePlaybackBlocked(false);
        remotePlaybackNoticeShownRef.current = false;
        if (sessionChannel === 'video-blur' && hasVideoTrack) {
          setRemoteVideoReady(true);
        }
      })
      .catch(() => {
        setRemotePlaybackBlocked(true);
        if (!remotePlaybackNoticeShownRef.current) {
          remotePlaybackNoticeShownRef.current = true;
          addSystemMessage('Tarayıcı gelen sesi otomatik başlatmadı. Sesi Aç düğmesini kullanın.');
        }
      });

    setSessionStatus('active');
    addSystemMessage("Görüşme başladı!");
  }, [addSystemMessage, markRemoteUnavailable, sessionChannel]);

  useEffect(() => {
    let isCurrent = true;

    if (!user || !hasLoadedSessions || !currentSession || !sessionAccess.canJoin) {
      setRoomAccess(null);
      setRoomAccessError('');
      setIsLoadingRoomAccess(false);
      return undefined;
    }

    setIsLoadingRoomAccess(true);
    setRoomAccess(null);
    setRoomAccessError('');

    getSessionRoomAccess(currentSession.id).then((result) => {
      if (!isCurrent) return;

      const expectedRole = isClient ? 'client' : 'psychologist';
      if (
        !result.success
        || result.access?.participantRole !== expectedRole
        || result.access?.channel !== currentSession.channel
      ) {
        setRoomAccessError(result.error || 'Seans odası kimliği doğrulanamadı.');
        setRoomAccess(null);
      } else {
        setRoomAccess(result.access);
      }
      setIsLoadingRoomAccess(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [currentSession, getSessionRoomAccess, hasLoadedSessions, isClient, sessionAccess.canJoin, user]);

  useEffect(() => {
    if (!user) return;
    if (isWaitingForSession) return;
    if (!currentSession && !isMockUser && !location.state?.channel) {
      navigate(isClient ? '/panel' : '/psikolog-panel', { replace: true });
    }
  }, [currentSession, isClient, isMockUser, isWaitingForSession, location.state, navigate, user]);

  // Setup Camera and Streams
  useEffect(() => {
    if (isAccessBlocked || isWaitingForSession || !myPeerId || !targetPeerId) return undefined;

    const isMounted = { current: true };
    const peerMetadata = {
      sessionId: String(sessionId),
      role: participantRole,
    };
    const clearConnectionAttemptTimer = () => {
      clearTimeout(connectionAttemptTimerRef.current);
      connectionAttemptTimerRef.current = null;
    };
    const initCamera = async () => {
      if (IS_DEMO_MODE) {
        setMicrophoneAvailable(false);
        setMicOn(false);

        if (sessionChannel === 'text') {
          demoModeRef.current = true;
          setSessionStatus('active');
          addSystemMessage('Yerel metin simülasyonu hazır. Mesajlar yalnızca bu tarayıcıda işlenir.');
          return;
        }

        if (sessionChannel === 'video-blur') {
          const demoCanvas = document.createElement('canvas');
          demoCanvas.width = 1280;
          demoCanvas.height = 720;
          drawCanvasNotice(
            demoCanvas.getContext('2d'),
            demoCanvas,
            'Güvenli demo görüntüsü',
            'Kamera izni gerekmez',
          );
          const demoStream = demoCanvas.captureStream(15);
          localStreamRef.current = demoStream;
          blurStreamRef.current = demoStream;
          setCameraAvailable(false);
          setCamOn(true);
          camOnRef.current = true;
          syncPipPreview();
          setSessionStatus('ready');
          addSystemMessage('Demo görüntüsü hazır. Görüşme simülasyonunu başlatabilirsiniz.');
          return;
        }

        const silentAudio = createSilentAudioStream();
        if (silentAudio) {
          fallbackAudioContextRef.current = silentAudio.audioContext;
          fallbackAudioNodeRef.current = silentAudio.source;
          localStreamRef.current = silentAudio.stream;
        }
        setCameraAvailable(null);
        demoModeRef.current = true;
        setSessionStatus('active');
        addSystemMessage('Yerel sesli görüşme simülasyonu hazır. Gerçek mikrofon verisi kullanılmaz.');
        return;
      }

      // Eğer sadece metin (yazışma) ise, kamerayı ve mikrofonu hiç isteme!
      if (sessionChannel === 'text') {
        initPeer();
        return;
      }

      try {
        const media = await acquireSessionMedia({
          mediaDevices: navigator.mediaDevices,
          includeVideo: sessionChannel === 'video-blur',
        });
        if (!isMounted.current) {
          media.stream?.getTracks().forEach(track => track.stop());
          return;
        }

        setMicrophoneAvailable(media.audioAvailable);
        setMicOn(media.audioAvailable);
        setCameraAvailable(media.videoAvailable);
        setCamOn(media.videoAvailable === true);
        camOnRef.current = media.videoAvailable === true;

        if (!media.audioAvailable) {
          addSystemMessage('Mikrofon izni alınamadı. Sesiniz karşı tarafa iletilmeyecek.');
        }
        if (sessionChannel === 'video-blur' && !media.videoAvailable) {
          addSystemMessage(media.audioAvailable
            ? 'Kamera izni alınamadı. Görüşmeye yalnızca ses ile devam ediliyor.'
            : 'Kamera izni alınamadı. Görüntünüz karşı tarafa iletilmeyecek.');
        }

        let stream = media.stream;
        if (!media.audioAvailable) {
          closeFallbackAudio();
          const silentAudio = createSilentAudioStream();
          if (silentAudio) {
            fallbackAudioContextRef.current = silentAudio.audioContext;
            fallbackAudioNodeRef.current = silentAudio.source;
            if (stream) {
              silentAudio.stream.getAudioTracks().forEach(track => stream.addTrack(track));
            } else {
              stream = silentAudio.stream;
            }
          }
        }
        localStreamRef.current = stream;

        if (shouldUseBlurStream) {
          let outgoingVideoStream = null;
          if (media.videoAvailable && stream && hiddenVideoRef.current && canvasRef.current) {
            hiddenVideoRef.current.srcObject = stream;
            void hiddenVideoRef.current.play().catch(() => {});
            drawToCanvas();
            outgoingVideoStream = canvasRef.current.captureStream(30);
          } else {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            drawCanvasNotice(
              canvas.getContext('2d'),
              canvas,
              'Kamera kullanılamıyor',
              media.audioAvailable ? 'Sesli görüşme devam ediyor' : 'Medya izni gerekli',
            );
            outgoingVideoStream = canvas.captureStream(15);
          }

          stream?.getAudioTracks().forEach(track => outgoingVideoStream.addTrack(track));
          blurStreamRef.current = outgoingVideoStream;
        }

        syncPipPreview();
      } catch (err) {
        console.error('Medya akışı hazırlanamadı:', err);
        setMicrophoneAvailable(false);
        setCameraAvailable(sessionChannel === 'video-blur' ? false : null);
        setMicOn(false);
        setCamOn(false);
        addSystemMessage('Kamera ve mikrofon akışı hazırlanamadı. Tarayıcı izinlerini kontrol edin.');
        setSessionStatus('ready');
      } finally {
        // React StrictMode causes useEffect to run twice. 
        // We add a delay to allow the PeerJS server to drop the old connection before trying to claim the same ID again.
        setTimeout(() => {
          if (!isMounted.current) return;
          initPeer();
        }, 1500);
      }
    };

    const scheduleClientReconnect = () => {
      if (!isClient || demoModeRef.current) return;
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (!isMounted.current || demoModeRef.current || !peerRef.current || peerRef.current.destroyed) return;
        if (!shouldRetrySessionConnection({
          connection: connRef.current,
          call: callRef.current,
        })) return;

        const staleConnection = connRef.current;
        if (staleConnection) {
          connRef.current = null;
          staleConnection.close();
        }
        connectToPeer(peerRef.current);
      }, 2000);
    };

    const markCallClosed = (call) => {
      if (!isMounted.current) return;
      if (callRef.current === call) {
        callRef.current = null;
      }
      markRemoteUnavailable();
      scheduleClientReconnect();
    };

    const bindCallHandlers = (call) => {
      callRef.current = call;
      call.on('stream', attachRemoteStream);
      call.on('close', () => markCallClosed(call));
      call.on('error', () => markCallClosed(call));
    };

    const bindConnectionHandlers = (conn) => {
      conn.on('close', () => {
        if (!isMounted.current) return;
        if (connRef.current === conn) {
          clearConnectionAttemptTimer();
          connRef.current = null;
        }

        if (!callRef.current) {
          markRemoteUnavailable();
          scheduleClientReconnect();
        }
      });
      conn.on('error', () => {
        if (!isMounted.current || connRef.current !== conn) return;
        clearConnectionAttemptTimer();
        connRef.current = null;
        if (!callRef.current) {
          markRemoteUnavailable('Sohbet bağlantısı kesildi. Yeniden bağlanması bekleniyor...');
          scheduleClientReconnect();
        }
      });
    };

    const isExpectedPeer = (connection) => isExpectedSessionPeer({
      connection,
      targetPeerId,
      sessionId,
      expectedRole: expectedPeerRole,
    });

    const initPeer = () => {
      const peerConfig = { debug: import.meta.env.DEV ? 2 : 1 };
      const peer = new Peer(myPeerId, peerConfig);

      peerRef.current = peer;

      peer.on('open', () => {
        peerInitRetryRef.current = 0;
        setSessionStatus('ready');
        addSystemMessage("Sunucuya bağlanıldı. Karşı taraf bekleniyor...");
        
        // Client initiates the call to Psychologist
        if (isClient) {
          const tryConnect = () => {
            if (callRef.current || connRef.current?.open) return;
            if (!connRef.current) connectToPeer(peer);
            retryTimerRef.current = setTimeout(tryConnect, 3000); // 3 saniyede bir yokla
          };
          tryConnect();
        }
      });

      // When Psychologist receives connection/call from Client
      peer.on('connection', (conn) => {
        if (!isExpectedPeer(conn)) {
          conn.close();
          addSystemMessage('Yetkisiz bir bağlantı isteği reddedildi.');
          return;
        }
        handleDataConnection(conn);
        bindConnectionHandlers(conn);
      });

      peer.on('call', (call) => {
        if (!isExpectedPeer(call)) {
          call.close();
          addSystemMessage('Yetkisiz bir görüşme isteği reddedildi.');
          return;
        }

        // Answer with my stream (Eğer video-blur ise blurStream, değilse localStream(sadece ses))
        const myStream = shouldUseBlurStream ? blurStreamRef.current : localStreamRef.current;
        
        // Metin modunda call gelmemeli ama gelirse boş stream dön
        if (sessionChannel === 'text' || !myStream) return;
        
        call.answer(myStream);
        bindCallHandlers(call);
      });

      peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        // Eğer Psikolog'un sabit ID'si "is taken" ise (sayfa yenileme çakışması) 
        // pes etme, 2 saniye bekle ve sunucu temizlenince tekrar dene.
        if (err.type === 'unavailable-id' && peerInitRetryRef.current < 2) {
          peerInitRetryRef.current += 1;
          addSystemMessage("Sunucu eski bağlantınızı temizliyor. Birkaç saniye içinde yeniden denenecek...");
          setTimeout(() => {
            if (isMounted.current) {
              initPeer();
            }
          }, 2000);
        } else if (err.type === 'unavailable-id') {
          addSystemMessage('Bu randevu başka bir sekmede açık. Diğer sekmeyi kapatıp sayfayı yenileyin.');
        } else if (err.type === 'peer-unavailable' && isClient) {
          clearConnectionAttemptTimer();
          if (connRef.current) {
            connRef.current.close();
            connRef.current = null;
          }
          scheduleClientReconnect();
        } else if (err.type !== 'peer-unavailable') {
          addSystemMessage('Görüşme sunucusuna bağlanılamadı. İnternet bağlantınızı kontrol edin.');
        }
      });

      peer.on('disconnected', () => {
        if (!isMounted.current || peer.destroyed) return;
        addSystemMessage('Görüşme sunucusuyla bağlantı yenileniyor...');
        try {
          peer.reconnect();
        } catch {
          // The regular peer error handler will show a stable failure state.
        }
      });
    };

    const connectToPeer = (peer) => {
      if (!shouldRetrySessionConnection({
        connection: connRef.current,
        call: callRef.current,
      })) return;

      const staleConnection = connRef.current;
      if (staleConnection) {
        connRef.current = null;
        staleConnection.close();
      }

      // Connect Data
      const conn = peer.connect(targetPeerId, {
        metadata: peerMetadata,
        serialization: 'json',
        reliable: true,
      });
      connRef.current = conn;
      bindConnectionHandlers(conn);
      clearConnectionAttemptTimer();
      connectionAttemptTimerRef.current = setTimeout(() => {
        if (!isMounted.current || connRef.current !== conn || conn.open) return;

        connRef.current = null;
        conn.close();
        addSystemMessage('Bağlantı yanıt vermedi. Otomatik olarak yeniden deneniyor...');
        scheduleClientReconnect();
      }, SESSION_CONNECTION_ATTEMPT_TIMEOUT_MS);
      
      conn.on('open', () => {
        clearConnectionAttemptTimer();
        handleDataConnection(conn);
        connRef.current = conn;
        clearTimeout(retryTimerRef.current);
        
        // Connect Media ONLY after Data is established
        if (sessionChannel === 'text') return; // Metinse burada bitir

        const myStream = shouldUseBlurStream ? blurStreamRef.current : localStreamRef.current;
        if (myStream && !callRef.current) {
          const call = peer.call(targetPeerId, myStream, { metadata: peerMetadata });
          bindCallHandlers(call);
        }
      });
      
    };

    initCamera();

    return () => {
      isMounted.current = false;
      clearTimeout(retryTimerRef.current);
      clearConnectionAttemptTimer();
      clearTimeout(demoResponseTimerRef.current);
      cancelAnimationFrame(animationFrameId.current);
      if (callRef.current) {
        callRef.current.close();
      }
      if (connRef.current) {
        connRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (blurStreamRef.current && blurStreamRef.current !== localStreamRef.current) {
        blurStreamRef.current.getTracks().forEach(t => t.stop());
      }
      closeFallbackAudio();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [sessionId, sessionChannel, isClient, myPeerId, targetPeerId, drawToCanvas, handleDataConnection, attachRemoteStream, addSystemMessage, markRemoteUnavailable, isAccessBlocked, isWaitingForSession, shouldUseBlurStream, syncPipPreview, closeFallbackAudio, expectedPeerRole, participantRole]); // Run correctly with dependencies

  useEffect(() => {
    pipModeRef.current = pipMode;
    syncPipPreview();
  }, [pipMode, syncPipPreview]);

  const sendMessage = (e) => {
    e.preventDefault();
    const safeText = sanitizeSessionChatText(chatInput);
    if (!safeText) return;

    const msg = {
      id: crypto.randomUUID(),
      text: safeText,
      sender: isClient ? 'client' : 'psychologist',
      time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})
    };

    setMessages(prev => [...prev, msg]);
    if (demoModeRef.current) {
      const response = {
        id: crypto.randomUUID(),
        text: isClient
          ? 'Demo uzmanı mesajınızı aldı. Bu yanıt yalnızca ürün akışını göstermek için oluşturuldu.'
          : 'Demo danışanı mesajınızı aldı. Bu yanıt yalnızca ürün akışını göstermek için oluşturuldu.',
        sender: isClient ? 'psychologist' : 'client',
        time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}),
      };
      clearTimeout(demoResponseTimerRef.current);
      demoResponseTimerRef.current = setTimeout(() => {
        if (demoModeRef.current) {
          setMessages(prev => [...prev, response]);
        }
      }, 350);
    } else if (connRef.current && connRef.current.open) {
      connRef.current.send(msg);
    } else {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), text: 'Karşı taraf odada olmadığı için mesajınız iletilemedi.', sender: 'system', time: new Date().toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})
      }]);
    }
    setChatInput('');
  };

  // Timer
  useEffect(() => {
    let interval = null;
    if (sessionStatus === 'active') {
      interval = setInterval(() => {
        setSessionTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [sessionStatus]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !micOn;
      setMicOn(!micOn);
    }
  };

  const resumeRemotePlayback = async () => {
    const remoteElement = remoteVideoRef.current;
    if (!remoteElement) return;

    try {
      remoteElement.muted = false;
      remoteElement.volume = 1;
      await remoteElement.play();
      setRemotePlaybackBlocked(false);
      remotePlaybackNoticeShownRef.current = false;
      if (sessionChannel === 'video-blur') {
        setRemoteVideoReady(true);
      }
      addSystemMessage('Karşı tarafın sesi açıldı.');
    } catch {
      addSystemMessage('Ses başlatılamadı. Tarayıcının ses iznini ve cihaz ses düzeyini kontrol edin.');
    }
  };

  const toggleCam = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      const nextCamOn = !camOn;
      videoTrack.enabled = nextCamOn;
      camOnRef.current = nextCamOn;
      setCamOn(nextCamOn);
    }
  };

  const endCall = async () => {
    if (callRef.current) callRef.current.close();
    if (connRef.current) connRef.current.close();
    if (peerRef.current) peerRef.current.destroy();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (blurStreamRef.current && blurStreamRef.current !== localStreamRef.current) {
      blurStreamRef.current.getTracks().forEach(track => track.stop());
    }
    closeFallbackAudio();
    if (!isClient && currentSession?.status === 'upcoming' && sessionStatus === 'active' && !demoModeRef.current) {
      await updateSession(currentSession.id, { status: 'completed', completedAt: new Date().toISOString() });
    }
    navigate(isClient ? '/panel' : '/psikolog-panel');
  };

  const startDemoMode = () => {
    if (!ALLOW_LOCAL_SIMULATION) return;
    const demoStream = shouldUseBlurStream
      ? blurStreamRef.current
      : localStreamRef.current;

    if (remoteVideoRef.current && demoStream) {
      demoModeRef.current = true;
      clearTimeout(retryTimerRef.current);
      clearTimeout(connectionAttemptTimerRef.current);
      connectionAttemptTimerRef.current = null;
      if (connRef.current && !connRef.current.open) {
        const staleConnection = connRef.current;
        connRef.current = null;
        staleConnection.close();
      }
      remoteVideoRef.current.srcObject = demoStream;
      setRemoteVideoMissing(false);
      setRemoteVideoReady(true);
      setSessionStatus('active');
      addSystemMessage("Simülasyon modu başlatıldı. Büyük ekranda karşı tarafa gidecek güvenli seans akışı gösteriliyor.");
    } else {
      addSystemMessage("Demo başlatılamadı: Kamera kapalı.");
    }
  };

  const showRemoteVideoOverlay = sessionChannel === 'video-blur'
    && (sessionStatus !== 'active' || remoteVideoMissing || !remoteVideoReady);
  const remoteVideoOverlayText = sessionStatus === 'active'
    ? (remoteVideoMissing ? 'Karşı tarafın kamera görüntüsü bekleniyor...' : 'Görüntü hazırlanıyor...')
    : (sessionStatus === 'ready' ? 'Karşı tarafın bağlanması bekleniyor...' : 'Bağlanılıyor...');
  const remoteVideoOverlayDetail = cameraAvailable === false && microphoneAvailable
    ? 'Kamera kullanılamıyor; sesiniz karşı tarafa iletilmeye devam ediyor.'
    : microphoneAvailable === false
      ? 'Mikrofon kullanılamıyor; sesiniz karşı tarafa iletilmiyor.'
      : 'Diğer taraf aynı randevuya girdiğinde görüntü burada açılacak.';

  if (isWaitingForSession) {
    return (
      <div className="session-room session-room-blocked">
        <Navbar />
        <main className="session-access-main">
          <section className="session-access-panel">
            <span className="session-access-eyebrow">Seans Girişi</span>
            <h1>Randevu hazırlanıyor</h1>
            <p>Seans bilgileri yükleniyor. Birkaç saniye içinde oda açılacak.</p>
          </section>
        </main>
      </div>
    );
  }

  if (isAccessBlocked) {
    return (
      <div className="session-room session-room-blocked">
        <Navbar />
        <main className="session-access-main">
          <section className="session-access-panel">
            <span className="session-access-eyebrow">Seans Girişi</span>
            <h1>{isRoomIdentityMissing ? 'Seans odası açılamadı' : sessionAccess.label}</h1>
            <p>
              {isRoomIdentityMissing
                ? (roomAccessError || 'Bu randevu için güvenli oda erişimi doğrulanamadı. Lütfen tekrar deneyin.')
                : currentSession
                  ? sessionAccess.helper
                  : 'Bu randevu kaydı bulunamadı veya artık erişilebilir değil.'}
            </p>
            {currentSession && (
              <div className="session-access-summary">
                <div>
                  <span>Tarih</span>
                  <strong>{new Date(`${currentSession.date}T12:00:00`).toLocaleDateString('tr-TR')}</strong>
                </div>
                <div>
                  <span>Saat</span>
                  <strong>{currentSession.time}</strong>
                </div>
                <div>
                  <span>Ödeme</span>
                  <strong>
                    {!currentSession.paymentRequired
                      ? 'Bu aşamada alınmıyor'
                      : currentSession.paymentStatus === 'paid' ? 'Alındı' : 'Bekliyor'}
                  </strong>
                </div>
              </div>
            )}
            <div className="session-access-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(panelPath)}>
                Panele Dön
              </button>
              {isClient && currentSession?.status === 'completed' && !currentSession.reviewed && (
                <button type="button" className="btn btn-outline" onClick={() => navigate(`/degerlendirme?session=${currentSession.id}`)}>
                  Değerlendir
                </button>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="session-room">
      <Navbar />
      <h1 className="sr-only">
        {isClient ? 'Psikolog ile seans odası' : 'Danışan ile seans odası'}
      </h1>
      
      {/* Invisible video/canvas for Blur Processing */}
      <div style={{ display: 'none' }}>
        <video ref={hiddenVideoRef} muted autoPlay playsInline />
        <canvas ref={canvasRef} />
      </div>

      {/* Header */}
      <header className="session-header">
        <div className="session-header-left">
          <div className={`session-status ${sessionStatus === 'active' ? 'active' : ''}`}>
            <span className="status-dot"></span>
            {sessionStatus === 'connecting' ? connectingStatusLabel : 
             sessionStatus === 'ready' ? 'Karşı Taraf Bekleniyor' : 'Bağlantı Aktif'}
          </div>
          <div className="session-timer">{formatTime(sessionTime)}</div>
        </div>
        <div className="session-with">
          {isClient ? 'Psikolog ile Görüşme' : 'Danışan ile Görüşme'}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-controls="session-chat-panel"
          aria-expanded={isChatOpen || sessionChannel === 'text'}
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          💬 Sohbet {messages.length > 1 ? `(${messages.length-1})` : ''}
        </button>
      </header>

      {/* Main Area */}
      <main className="session-content" style={{ display: sessionChannel === 'text' ? 'block' : 'flex' }}>
        
        {/* Video or Audio Container */}
        {sessionChannel === 'text' ? null : sessionChannel === 'voice' ? (
          <div className="session-video-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <audio ref={remoteVideoRef} autoPlay playsInline />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '6rem', margin: '0 auto', opacity: sessionStatus === 'active' ? 1 : 0.5, animation: sessionStatus === 'active' ? 'pulse 2s infinite' : 'none' }}>🎙️</div>
              <h3 className="mt-md">Sadece Sesli Görüşme</h3>
              <p className="text-tertiary">Kamera gizlilik nedeniyle kapalıdır.</p>
              {sessionStatus !== 'active' && <p style={{ color: 'var(--primary)' }}>Bağlanılıyor...</p>}
            </div>
          </div>
        ) : (
          <div className={`session-video-area ${showRemoteVideoOverlay ? 'waiting' : ''}`}>
            <div className="video-placeholder">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="video-main"
                onCanPlay={() => setRemoteVideoReady(true)}
                onLoadedData={() => setRemoteVideoReady(true)}
                onPlaying={() => setRemoteVideoReady(true)}
                onWaiting={() => setRemoteVideoReady(false)}
                style={{ objectFit: 'contain', width: '100%', height: '100%', borderRadius: 'var(--radius-lg)' }}
              />
              {showRemoteVideoOverlay && (
                <div className="remote-video-state">
                  <div className="remote-video-state-card">
                    <span className="remote-video-state-icon">⌛</span>
                    <div>
                      <div className="video-name">{remoteVideoOverlayText}</div>
                      <p className="video-subtitle">{remoteVideoOverlayDetail}</p>
                    </div>
                  </div>
                  <div className="remote-video-state-actions">
                    {cameraAvailable === false && (
                      <span className="media-fallback-badge">Kamera kullanılamıyor</span>
                    )}
                    {microphoneAvailable === false && (
                      <span className="media-fallback-badge">Mikrofon kullanılamıyor</span>
                    )}
                    {ALLOW_LOCAL_SIMULATION && (
                      <button type="button" className="btn btn-primary" onClick={startDemoMode}>
                        {IS_DEMO_MODE ? 'Görüşme Simülasyonunu Başlat' : 'Simülasyon Modunu Başlat'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Picture in Picture (Self) */}
            <div className="video-pip">
              <video 
                ref={pipVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
              <span className="pip-label">Siz</span>
            </div>
          </div>
        )}

        {/* Blur Controls (Sadece Görüntülü görüşmede) */}
        {shouldUseBlurStream && (
          <div className="blur-control">
            <div className="blur-control-header">
              <div>
                <span className="blur-eyebrow">Güvenli Kamera</span>
                <strong>{activeBlurPreset.label}</strong>
              </div>
              <span className="blur-strength">{activeBlurPreset.pixels}px</span>
            </div>

            <label className="blur-label" htmlFor="session-blur-level">
              Bulanıklık
              <span>{blurSliderLevel}/5</span>
            </label>
            <div className="blur-slider-wrapper">
              <span className="blur-min">Net</span>
              <input
                id="session-blur-level"
                type="range"
                className="blur-slider"
                min="0"
                max="5"
                step="1"
                value={blurSliderLevel}
                onChange={(e) => handleBlurChange(e.target.value)}
                aria-label="Bulanıklık seviyesi"
              />
              <span className="blur-max">Gizli</span>
            </div>

            <div className="blur-level-buttons" aria-label="Bulanıklık seviyesi seçenekleri">
              {SESSION_BLUR_PRESETS.map(preset => (
                <button
                  key={preset.level}
                  type="button"
                  className={`blur-level-button ${blurSliderLevel === preset.level ? 'active' : ''}`}
                  aria-pressed={blurSliderLevel === preset.level}
                  onClick={() => handleBlurChange(preset.level)}
                >
                  {preset.level}
                </button>
              ))}
            </div>

            {showClearVideoConsent && (
              <label className={`blur-clear-consent ${clearVideoConsent ? 'confirmed' : ''}`}>
                <input
                  type="checkbox"
                  checked={clearVideoConsent}
                  onChange={handleClearVideoConsent}
                />
                <span>
                  <strong>Blursuz görüntüyü paylaş</strong>
                  <small>İşaretlendiğinde yüzünüz psikoloğa net iletilir.</small>
                </span>
              </label>
            )}
          
            <div className="blur-preview-row">
              <span>Önizleme</span>
              <div className="blur-segmented">
                <button
                  type="button"
                  className={pipMode === 'safe' ? 'active' : ''}
                  onClick={() => setPipMode('safe')}
                >
                  Güvenli
                </button>
                <button
                  type="button"
                  className={pipMode === 'raw' ? 'active' : ''}
                  onClick={() => setPipMode('raw')}
                >
                  Net
                </button>
              </div>
            </div>

            <div className="blur-send-status">
              <span>Giden görüntü</span>
              <strong className={isSessionClearVideoLevel(blurLevel) ? 'clear' : ''}>
                {isSessionClearVideoLevel(blurLevel) ? 'Blursuz' : 'Blurlu'}
              </strong>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        <div id="session-chat-panel" className={`session-chat ${isChatOpen || sessionChannel === 'text' ? 'open' : ''}`} style={sessionChannel === 'text' ? { position: 'relative', width: '100%', height: '100%', borderLeft: 'none', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' } : {}}>
          <div className="chat-header">
            <h4>Seans Sohbeti</h4>
            {sessionChannel !== 'text' && (
              <button type="button" className="btn-ghost" aria-label="Sohbeti kapat" onClick={() => setIsChatOpen(false)}>✕</button>
            )}
          </div>
          
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`chat-message ${m.sender === 'system' ? 'system' : (m.sender === (isClient ? 'client' : 'psychologist') ? 'client' : 'psychologist')}`} style={{ textAlign: m.sender === 'system' ? 'center' : 'left' }}>
                {m.sender === 'system' ? (
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: '4px 0' }}>--- {m.text} ---</span>
                ) : (
                  <div className="message-bubble" style={{ alignSelf: m.sender === (isClient ? 'client' : 'psychologist') ? 'flex-end' : 'flex-start' }}>
                    <p>{m.text}</p>
                    <span className="message-time">{m.time}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className="chat-input" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="session-chat-input">Mesajınız</label>
            <input 
              id="session-chat-input"
              type="text" 
              placeholder="Mesaj yazın..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={MAX_SESSION_MESSAGE_LENGTH}
            />
            <button type="submit" className="btn btn-primary">Gönder</button>
          </form>
        </div>
      </main>

      {/* Bottom Controls */}
      <footer className="session-controls">
        <div className="controls-group">
          {remotePlaybackBlocked && (
            <button
              type="button"
              className="control-btn active"
              onClick={resumeRemotePlayback}
              title="Karşı tarafın sesini aç"
              aria-label="Karşı tarafın sesini aç"
            >
              🔊
              <span>Sesi Aç</span>
            </button>
          )}
        </div>
        
        <div className="controls-group">
          <button
            type="button"
            className={`control-btn ${!micOn ? 'off' : ''}`}
            aria-pressed={micOn}
            onClick={toggleMic}
            title={microphoneAvailable === false ? 'Mikrofon kullanılamıyor' : 'Mikrofon'}
            disabled={sessionChannel === 'text' || microphoneAvailable === false}
          >
            {micOn ? '🎙️' : '🔇'}
            <span>{sessionChannel === 'text'
              ? 'Kapalı'
              : microphoneAvailable === false
                ? 'İzin Yok'
                : micOn ? 'Açık' : 'Kapalı'}</span>
          </button>
          
          <button
            type="button"
            className={`control-btn ${!camOn ? 'off' : ''}`}
            aria-pressed={camOn}
            onClick={toggleCam}
            title={cameraAvailable === false ? 'Kamera kullanılamıyor' : 'Kamera'}
            disabled={sessionChannel !== 'video-blur' || cameraAvailable === false}
          >
            {camOn ? '📹' : '🚫'}
            <span>{sessionChannel !== 'video-blur'
              ? 'Kapalı'
              : cameraAvailable === false
                ? 'İzin Yok'
                : camOn ? 'Açık' : 'Kapalı'}</span>
          </button>
          
          <button type="button" className="control-btn emergency" onClick={endCall} title="Aramayı Sonlandır">
            📞
            <span>Kapat</span>
          </button>
        </div>

        <div className="controls-group">
          <button
            type="button"
            className={`control-btn ${isChatOpen ? 'active' : ''}`}
            aria-controls="session-chat-panel"
            aria-expanded={isChatOpen || sessionChannel === 'text'}
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            💬
            <span>Sohbet</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
