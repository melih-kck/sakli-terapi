import { describe, expect, it, vi } from 'vitest';
import { acquireSessionMedia } from './session-media';

const createTrack = kind => ({ kind, enabled: true, readyState: 'live' });
const createTestStream = tracks => ({
  tracks,
  getTracks: () => tracks,
  getAudioTracks: () => tracks.filter(track => track.kind === 'audio'),
  getVideoTracks: () => tracks.filter(track => track.kind === 'video'),
});

describe('session-media', () => {
  it('uses a combined camera and microphone stream when both are available', async () => {
    const combinedStream = createTestStream([createTrack('video'), createTrack('audio')]);
    const getUserMedia = vi.fn().mockResolvedValue(combinedStream);

    const result = await acquireSessionMedia({
      mediaDevices: { getUserMedia },
      includeVideo: true,
      createStream: createTestStream,
    });

    expect(result).toEqual({
      stream: combinedStream,
      audioAvailable: true,
      videoAvailable: true,
    });
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('keeps the microphone when the combined camera request fails', async () => {
    const audioTrack = createTrack('audio');
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new Error('camera blocked'))
      .mockResolvedValueOnce(createTestStream([audioTrack]))
      .mockRejectedValueOnce(new Error('camera blocked'));

    const result = await acquireSessionMedia({
      mediaDevices: { getUserMedia },
      includeVideo: true,
      createStream: createTestStream,
    });

    expect(result.audioAvailable).toBe(true);
    expect(result.videoAvailable).toBe(false);
    expect(result.stream.getAudioTracks()).toEqual([audioTrack]);
  });

  it('keeps the camera while clearly reporting that the microphone is unavailable', async () => {
    const videoTrack = createTrack('video');
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new Error('microphone blocked'))
      .mockRejectedValueOnce(new Error('microphone blocked'))
      .mockResolvedValueOnce(createTestStream([videoTrack]));

    const result = await acquireSessionMedia({
      mediaDevices: { getUserMedia },
      includeVideo: true,
      createStream: createTestStream,
    });

    expect(result.audioAvailable).toBe(false);
    expect(result.videoAvailable).toBe(true);
    expect(result.stream.getVideoTracks()).toEqual([videoTrack]);
  });

  it('reports an unavailable microphone instead of presenting a silent fallback as live', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error('microphone blocked'));

    const result = await acquireSessionMedia({
      mediaDevices: { getUserMedia },
      includeVideo: false,
      createStream: createTestStream,
    });

    expect(result).toEqual({
      stream: null,
      audioAvailable: false,
      videoAvailable: null,
    });
  });
});
