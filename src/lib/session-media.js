const getTracksByKind = (stream, kind) => {
  if (!stream) return [];
  return kind === 'audio'
    ? stream.getAudioTracks?.() || []
    : stream.getVideoTracks?.() || [];
};

const summarizeStream = (stream, includeVideo) => ({
  stream,
  audioAvailable: getTracksByKind(stream, 'audio').length > 0,
  videoAvailable: includeVideo
    ? getTracksByKind(stream, 'video').length > 0
    : null,
});

export const acquireSessionMedia = async ({
  mediaDevices,
  includeVideo,
  createStream = tracks => new MediaStream(tracks),
}) => {
  if (!mediaDevices?.getUserMedia) {
    return {
      stream: null,
      audioAvailable: false,
      videoAvailable: includeVideo ? false : null,
    };
  }

  if (!includeVideo) {
    try {
      const stream = await mediaDevices.getUserMedia({ video: false, audio: true });
      return summarizeStream(stream, false);
    } catch {
      return { stream: null, audioAvailable: false, videoAvailable: null };
    }
  }

  try {
    const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
    return summarizeStream(stream, true);
  } catch {
    // A blocked camera must not discard a microphone that can still be used, or vice versa.
    let audioStream = null;
    let videoStream = null;
    try {
      audioStream = await mediaDevices.getUserMedia({ video: false, audio: true });
    } catch {
      // The camera can still be used when microphone access is unavailable.
    }
    try {
      videoStream = await mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      // The microphone can still be used when camera access is unavailable.
    }
    const tracks = [
      ...getTracksByKind(videoStream, 'video'),
      ...getTracksByKind(audioStream, 'audio'),
    ];

    return {
      stream: tracks.length > 0 ? createStream(tracks) : null,
      audioAvailable: getTracksByKind(audioStream, 'audio').length > 0,
      videoAvailable: getTracksByKind(videoStream, 'video').length > 0,
    };
  }
};
