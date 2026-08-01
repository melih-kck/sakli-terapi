import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { language, t } = useLanguage();
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
  const localizedSessionAccess = {
    ...sessionAccess,
    label: t(`dashboard.join.${sessionAccess.code}`)[0],
    helper: t(`dashboard.join.${sessionAccess.code}`)[1],
  };
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const translationRef = useRef(t);
  const localeRef = useRef(locale);
  translationRef.current = t;
  localeRef.current = locale;
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
    ? t('sessionRoom.connecting.text')
    : sessionChannel === 'voice'
      ? t('sessionRoom.connecting.voice')
      : t('sessionRoom.connecting.video');

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
    { id: 1, text: t('sessionRoom.initialMessage'), sender: 'system', time: new Date().toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'}) }
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
      drawCanvasNotice(
        ctx,
        canvas,
        translationRef.current('sessionRoom.system.cameraOffCanvas'),
        translationRef.current('sessionRoom.system.privacyModeCanvas'),
      );
    } else if (!videoReady) {
      drawCanvasNotice(
        ctx,
        canvas,
        translationRef.current('sessionRoom.system.cameraPreparingCanvas'),
        translationRef.current('sessionRoom.system.secureVideoCanvas'),
      );
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
      id: crypto.randomUUID(), text, sender: 'system', time: new Date().toLocaleTimeString(localeRef.current, {hour: '2-digit', minute:'2-digit'})
    }]);
  }, []);

  const markRemoteUnavailable = useCallback((message) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setRemotePlaybackBlocked(false);
    setRemoteVideoReady(false);
    setRemoteVideoMissing(sessionChannel === 'video-blur');
    setSessionStatus('ready');
    addSystemMessage(message || translationRef.current('sessionRoom.system.disconnected'));
  }, [addSystemMessage, sessionChannel]);

  const handleDataConnection = useCallback((conn) => {
    connRef.current = conn;

    const markOpen = () => {
      addSystemMessage(translationRef.current('sessionRoom.system.chatConnected'));
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
      addSystemMessage(translationRef.current('sessionRoom.system.remoteMicMissing'));
    }

    remoteStream.getVideoTracks().forEach((track) => {
      track.onended = () => markRemoteUnavailable(translationRef.current('sessionRoom.system.cameraDisconnected'));
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
          addSystemMessage(translationRef.current('sessionRoom.system.autoplayBlocked'));
        }
      });

    setSessionStatus('active');
    addSystemMessage(translationRef.current('sessionRoom.system.started'));
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
        setRoomAccessError(result.error || t('sessionRoom.system.roomIdentityFailed'));
        setRoomAccess(null);
      } else {
        setRoomAccess(result.access);
      }
      setIsLoadingRoomAccess(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [currentSession, getSessionRoomAccess, hasLoadedSessions, isClient, sessionAccess.canJoin, t, user]);

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
          addSystemMessage(translationRef.current('sessionRoom.system.demoTextReady'));
          return;
        }

        if (sessionChannel === 'video-blur') {
          const demoCanvas = document.createElement('canvas');
          demoCanvas.width = 1280;
          demoCanvas.height = 720;
          drawCanvasNotice(
            demoCanvas.getContext('2d'),
            demoCanvas,
            translationRef.current('sessionRoom.system.demoCanvasTitle'),
            translationRef.current('sessionRoom.system.demoCanvasSubtitle'),
          );
          const demoStream = typeof demoCanvas.captureStream === 'function'
            ? demoCanvas.captureStream(15)
            : null;
          if (demoStream) {
            localStreamRef.current = demoStream;
            blurStreamRef.current = demoStream;
          }
          if (remoteVideoRef.current) {
            remoteVideoRef.current.poster = demoCanvas.toDataURL('image/png');
          }
          setCameraAvailable(false);
          setCamOn(true);
          camOnRef.current = true;
          syncPipPreview();
          setSessionStatus('ready');
          addSystemMessage(translationRef.current('sessionRoom.system.demoVideoReady'));
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
        addSystemMessage(translationRef.current('sessionRoom.system.demoVoiceReady'));
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
          addSystemMessage(translationRef.current('sessionRoom.system.microphoneDenied'));
        }
        if (sessionChannel === 'video-blur' && !media.videoAvailable) {
          addSystemMessage(media.audioAvailable
            ? translationRef.current('sessionRoom.system.cameraAudioOnly')
            : translationRef.current('sessionRoom.system.cameraDenied'));
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
              translationRef.current('sessionRoom.system.cameraUnavailableCanvas'),
              media.audioAvailable
                ? translationRef.current('sessionRoom.system.audioContinuesCanvas')
                : translationRef.current('sessionRoom.system.mediaPermissionCanvas'),
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
        addSystemMessage(translationRef.current('sessionRoom.system.mediaFailed'));
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
          markRemoteUnavailable(translationRef.current('sessionRoom.system.chatDisconnected'));
          scheduleClientReconnect();
        }
      });
    };

    const isExpectedPeer = (connection) => isExpectedSessionPeer({
      connection,
      targetPeerId,
      expectedRole: expectedPeerRole,
    });

    const initPeer = () => {
      const peerConfig = { debug: import.meta.env.DEV ? 2 : 1 };
      const peer = new Peer(myPeerId, peerConfig);

      peerRef.current = peer;

      peer.on('open', () => {
        peerInitRetryRef.current = 0;
        setSessionStatus('ready');
        addSystemMessage(translationRef.current('sessionRoom.system.serverConnected'));
        
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
          addSystemMessage(translationRef.current('sessionRoom.system.unauthorizedConnection'));
          return;
        }
        handleDataConnection(conn);
        bindConnectionHandlers(conn);
      });

      peer.on('call', (call) => {
        if (!isExpectedPeer(call)) {
          call.close();
          addSystemMessage(translationRef.current('sessionRoom.system.unauthorizedCall'));
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
          addSystemMessage(translationRef.current('sessionRoom.system.staleConnection'));
          setTimeout(() => {
            if (isMounted.current) {
              initPeer();
            }
          }, 2000);
        } else if (err.type === 'unavailable-id') {
          addSystemMessage(translationRef.current('sessionRoom.system.duplicateTab'));
        } else if (err.type === 'peer-unavailable' && isClient) {
          clearConnectionAttemptTimer();
          if (connRef.current) {
            connRef.current.close();
            connRef.current = null;
          }
          scheduleClientReconnect();
        } else if (err.type !== 'peer-unavailable') {
          addSystemMessage(translationRef.current('sessionRoom.system.serverFailed'));
        }
      });

      peer.on('disconnected', () => {
        if (!isMounted.current || peer.destroyed) return;
        addSystemMessage(translationRef.current('sessionRoom.system.reconnecting'));
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
        addSystemMessage(translationRef.current('sessionRoom.system.connectionTimedOut'));
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
          ? t('sessionRoom.system.demoPsychologistReply')
          : t('sessionRoom.system.demoClientReply'),
        sender: isClient ? 'psychologist' : 'client',
        time: new Date().toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'}),
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
        id: crypto.randomUUID(), text: t('sessionRoom.system.messageDeliveryFailed'), sender: 'system', time: new Date().toLocaleTimeString(locale, {hour: '2-digit', minute:'2-digit'})
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
      addSystemMessage(t('sessionRoom.system.remoteAudioEnabled'));
    } catch {
      addSystemMessage(t('sessionRoom.system.remoteAudioFailed'));
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
    const canStartVisualDemo = IS_DEMO_MODE && sessionChannel === 'video-blur';

    if (remoteVideoRef.current && (demoStream || canStartVisualDemo)) {
      demoModeRef.current = true;
      clearTimeout(retryTimerRef.current);
      clearTimeout(connectionAttemptTimerRef.current);
      connectionAttemptTimerRef.current = null;
      if (connRef.current && !connRef.current.open) {
        const staleConnection = connRef.current;
        connRef.current = null;
        staleConnection.close();
      }
      if (demoStream) {
        remoteVideoRef.current.srcObject = demoStream;
      }
      setRemoteVideoMissing(false);
      setRemoteVideoReady(true);
      setSessionStatus('active');
      addSystemMessage(t('sessionRoom.demoStarted'));
    } else {
      addSystemMessage(t('sessionRoom.demoCameraOff'));
    }
  };

  const showRemoteVideoOverlay = sessionChannel === 'video-blur'
    && (sessionStatus !== 'active' || remoteVideoMissing || !remoteVideoReady);
  const remoteVideoOverlayText = sessionStatus === 'active'
    ? (remoteVideoMissing ? t('sessionRoom.remoteMissing') : t('sessionRoom.videoPreparing'))
    : (sessionStatus === 'ready' ? t('sessionRoom.waitingRemote') : t('sessionRoom.connectingShort'));
  const remoteVideoOverlayDetail = cameraAvailable === false && microphoneAvailable
    ? t('sessionRoom.cameraFallback')
    : microphoneAvailable === false
      ? t('sessionRoom.microphoneFallback')
      : t('sessionRoom.remoteHint');

  if (isWaitingForSession) {
    return (
      <div className="session-room session-room-blocked">
        <Navbar />
        <main className="session-access-main">
          <section className="session-access-panel">
            <span className="session-access-eyebrow">{t('sessionRoom.access')}</span>
            <h1>{t('sessionRoom.preparingTitle')}</h1>
            <p>{t('sessionRoom.preparingBody')}</p>
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
            <span className="session-access-eyebrow">{t('sessionRoom.access')}</span>
            <h1>{isRoomIdentityMissing ? t('sessionRoom.unavailableTitle') : localizedSessionAccess.label}</h1>
            <p>
              {isRoomIdentityMissing
                ? (roomAccessError || t('sessionRoom.unavailableBody'))
                : currentSession
                  ? localizedSessionAccess.helper
                  : t('sessionRoom.missingAppointment')}
            </p>
            {currentSession && (
              <div className="session-access-summary">
                <div>
                  <span>{t('sessionRoom.date')}</span>
                  <strong>{new Date(`${currentSession.date}T12:00:00`).toLocaleDateString(locale)}</strong>
                </div>
                <div>
                  <span>{t('sessionRoom.time')}</span>
                  <strong>{currentSession.time}</strong>
                </div>
                <div>
                  <span>{t('sessionRoom.payment')}</span>
                  <strong>
                    {!currentSession.paymentRequired
                      ? t('sessionRoom.paymentDisabled')
                      : currentSession.paymentStatus === 'paid' ? t('sessionRoom.paymentPaid') : t('sessionRoom.paymentPending')}
                  </strong>
                </div>
              </div>
            )}
            <div className="session-access-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(panelPath)}>
                {t('sessionRoom.backToPanel')}
              </button>
              {isClient && currentSession?.status === 'completed' && !currentSession.reviewed && (
                <button type="button" className="btn btn-outline" onClick={() => navigate(`/degerlendirme?session=${currentSession.id}`)}>
                  {t('sessionRoom.review')}
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
        {isClient ? t('sessionRoom.clientRoomTitle') : t('sessionRoom.psychologistRoomTitle')}
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
             sessionStatus === 'ready' ? t('sessionRoom.remoteWaiting') : t('sessionRoom.active')}
          </div>
          <div className="session-timer">{formatTime(sessionTime)}</div>
        </div>
        <div className="session-with">
          {isClient ? t('sessionRoom.withPsychologist') : t('sessionRoom.withClient')}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-controls="session-chat-panel"
          aria-expanded={isChatOpen || sessionChannel === 'text'}
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          💬 {t('sessionRoom.chat')} {messages.length > 1 ? `(${messages.length-1})` : ''}
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
              <h3 className="mt-md">{t('sessionRoom.voiceOnly')}</h3>
              <p className="text-tertiary">{t('sessionRoom.cameraPrivacy')}</p>
              {sessionStatus !== 'active' && <p style={{ color: 'var(--primary)' }}>{t('sessionRoom.connectingShort')}</p>}
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
                      <span className="media-fallback-badge">{t('sessionRoom.cameraUnavailable')}</span>
                    )}
                    {microphoneAvailable === false && (
                      <span className="media-fallback-badge">{t('sessionRoom.microphoneUnavailable')}</span>
                    )}
                    {ALLOW_LOCAL_SIMULATION && (
                      <button type="button" className="btn btn-primary" onClick={startDemoMode}>
                        {IS_DEMO_MODE ? t('sessionRoom.startDemo') : t('sessionRoom.startSimulation')}
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
              <span className="pip-label">{t('sessionRoom.you')}</span>
            </div>
          </div>
        )}

        {/* Blur Controls (Sadece Görüntülü görüşmede) */}
        {shouldUseBlurStream && (
          <div className="blur-control">
            <div className="blur-control-header">
              <div>
                <span className="blur-eyebrow">{t('sessionRoom.secureCamera')}</span>
                <strong>{t('sessionRoom.blurPresets')[activeBlurPreset.level]}</strong>
              </div>
              <span className="blur-strength">{activeBlurPreset.pixels}px</span>
            </div>

            <label className="blur-label" htmlFor="session-blur-level">
              {t('sessionRoom.blur')}
              <span>{blurSliderLevel}/5</span>
            </label>
            <div className="blur-slider-wrapper">
              <span className="blur-min">{t('sessionRoom.clear')}</span>
              <input
                id="session-blur-level"
                type="range"
                className="blur-slider"
                min="0"
                max="5"
                step="1"
                value={blurSliderLevel}
                onChange={(e) => handleBlurChange(e.target.value)}
                aria-label={t('sessionRoom.blur')}
              />
              <span className="blur-max">{t('sessionRoom.private')}</span>
            </div>

            <div className="blur-level-buttons" aria-label={t('sessionRoom.blurOptions')}>
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
                  <strong>{t('sessionRoom.shareClear')}</strong>
                  <small>{t('sessionRoom.shareClearBody')}</small>
                </span>
              </label>
            )}
          
            <div className="blur-preview-row">
              <span>{t('sessionRoom.preview')}</span>
              <div className="blur-segmented">
                <button
                  type="button"
                  className={pipMode === 'safe' ? 'active' : ''}
                  onClick={() => setPipMode('safe')}
                >
                  {t('sessionRoom.safe')}
                </button>
                <button
                  type="button"
                  className={pipMode === 'raw' ? 'active' : ''}
                  onClick={() => setPipMode('raw')}
                >
                  {t('sessionRoom.clear')}
                </button>
              </div>
            </div>

            <div className="blur-send-status">
              <span>{t('sessionRoom.outgoing')}</span>
              <strong className={isSessionClearVideoLevel(blurLevel) ? 'clear' : ''}>
                {isSessionClearVideoLevel(blurLevel) ? t('sessionRoom.unblurred') : t('sessionRoom.blurred')}
              </strong>
            </div>
          </div>
        )}

        {/* Chat Panel */}
        <div id="session-chat-panel" className={`session-chat ${isChatOpen || sessionChannel === 'text' ? 'open' : ''}`} style={sessionChannel === 'text' ? { position: 'relative', width: '100%', height: '100%', borderLeft: 'none', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' } : {}}>
          <div className="chat-header">
            <h4>{t('sessionRoom.sessionChat')}</h4>
            {sessionChannel !== 'text' && (
              <button type="button" className="btn-ghost" aria-label={t('sessionRoom.closeChat')} onClick={() => setIsChatOpen(false)}>✕</button>
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
            <label className="sr-only" htmlFor="session-chat-input">{t('sessionRoom.yourMessage')}</label>
            <input 
              id="session-chat-input"
              type="text" 
              placeholder={t('sessionRoom.messagePlaceholder')}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={MAX_SESSION_MESSAGE_LENGTH}
            />
            <button type="submit" className="btn btn-primary">{t('sessionRoom.send')}</button>
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
              title={t('sessionRoom.enableRemoteAudio')}
              aria-label={t('sessionRoom.enableRemoteAudio')}
            >
              🔊
              <span>{t('sessionRoom.enableAudio')}</span>
            </button>
          )}
        </div>
        
        <div className="controls-group">
          <button
            type="button"
            className={`control-btn ${!micOn ? 'off' : ''}`}
            aria-pressed={micOn}
            onClick={toggleMic}
            title={microphoneAvailable === false ? t('sessionRoom.microphoneUnavailable') : t('sessionRoom.microphone')}
            disabled={sessionChannel === 'text' || microphoneAvailable === false}
          >
            {micOn ? '🎙️' : '🔇'}
            <span>{sessionChannel === 'text'
              ? t('sessionRoom.off')
              : microphoneAvailable === false
                ? t('sessionRoom.denied')
                : micOn ? t('sessionRoom.on') : t('sessionRoom.off')}</span>
          </button>
          
          <button
            type="button"
            className={`control-btn ${!camOn ? 'off' : ''}`}
            aria-pressed={camOn}
            onClick={toggleCam}
            title={cameraAvailable === false ? t('sessionRoom.cameraUnavailable') : t('sessionRoom.camera')}
            disabled={sessionChannel !== 'video-blur' || cameraAvailable === false}
          >
            {camOn ? '📹' : '🚫'}
            <span>{sessionChannel !== 'video-blur'
              ? t('sessionRoom.off')
              : cameraAvailable === false
                ? t('sessionRoom.denied')
                : camOn ? t('sessionRoom.on') : t('sessionRoom.off')}</span>
          </button>
          
          <button type="button" className="control-btn emergency" onClick={endCall} title={t('sessionRoom.endCall')}>
            📞
            <span>{t('sessionRoom.close')}</span>
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
            <span>{t('sessionRoom.chat')}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
