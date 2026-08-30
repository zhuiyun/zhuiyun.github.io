(() => {
  'use strict';

  const namespace = 'urn:x-cast:com.yfuse.output';
  const context = cast.framework.CastReceiverContext.getInstance();
  const player = context.getPlayerManager();
  let latestMediaStatus = null;

  const nullableBoolean = (value) => typeof value === 'boolean' ? value : null;

  function deviceFacts() {
    const capabilities = context.getDeviceCapabilities() || {};
    return {
      dolbyVision: nullableBoolean(capabilities.is_dv_supported),
      dolbyAtmos: nullableBoolean(capabilities.is_dolby_atmos_supported),
    };
  }

  function supportsProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    let videoSupported = true;
    let audioSupported = true;
    if (profile.dolbyVision === true) {
      videoSupported =
        typeof profile.videoCodec === 'string' &&
        profile.videoCodec.length > 0 &&
        context.canDisplayType(
          'video/mp4',
          profile.videoCodec,
          profile.width,
          profile.height,
          profile.frameRate,
        );
    }
    if (profile.dolbyAtmos === true) {
      audioSupported =
        profile.audioCodec === 'ec-3' &&
        context.canDisplayType('audio/mp4', 'ec-3');
    }
    return videoSupported && audioSupported;
  }

  function sendCapabilities(senderId, revision, profile) {
    const facts = deviceFacts();
    context.sendCustomMessage(namespace, senderId, {
      type: 'capabilities.response',
      revision,
      dolbyVisionSupported: facts.dolbyVision,
      dolbyAtmosSupported: facts.dolbyAtmos,
      requestedMediaSupported: supportsProfile(profile),
      trackSelectionSupported: true,
      queueSupported: true,
    });
  }

  function sessionSnapshot() {
    const load = currentLoadFacts();
    if (!load) return null;
    const audioManager = player.getAudioTracksManager && player.getAudioTracksManager();
    const textManager = player.getTextTracksManager && player.getTextTracksManager();
    const audio = audioManager && audioManager.getActiveTrack && audioManager.getActiveTrack();
    const text = textManager && textManager.getActiveTracks && textManager.getActiveTracks();
    const queueManager = player.getQueueManager && player.getQueueManager();
    const queueItems = queueManager && queueManager.getItems && queueManager.getItems();
    const media = player.getMediaInformation();
    const customData = media && media.customData;
    return {
      type: 'session.state',
      revision: load.revision,
      queueIndex: customData && Number(customData.yfuseQueueIndex),
      queueSize: Array.isArray(queueItems) ? queueItems.length : null,
      activeAudioTrackId: audio ? audio.trackId : null,
      activeTextTrackIds: Array.isArray(text) ? text.map((track) => track.trackId) : [],
    };
  }

  function sendSessionState(senderId) {
    const snapshot = sessionSnapshot();
    if (snapshot) context.sendCustomMessage(namespace, senderId, snapshot);
  }

  function currentLoadFacts() {
    const media = player.getMediaInformation();
    const customData = media && media.customData;
    const revision = customData && Number(customData.yfuseRevision);
    const profile = customData && customData.yfuseProfile;
    if (!Number.isSafeInteger(revision) || !profile) return null;
    return { revision, profile };
  }

  function activeAtmosTrackConfirmed() {
    const active = player.getAudioTracksManager().getActiveTrack();
    if (!active) return false;
    const contentType = String(active.trackContentType || '');
    const customData = active.customData || {};
    return (
      /(?:ec-3|eac3)/i.test(contentType) &&
      (
        /spatialRendering\s*=\s*true/i.test(contentType) ||
        customData.spatialRendering === true ||
        customData.dolbyAtmos === true
      )
    );
  }

  function activeDolbyVisionConfirmed() {
    const videoInfo = latestMediaStatus && latestMediaStatus.videoInfo;
    return Boolean(videoInfo && videoInfo.hdrType === cast.framework.messages.HdrType.DV);
  }

  function sendOutputReceipt(playbackConfirmed, detail) {
    const load = currentLoadFacts();
    if (!load) return;
    const facts = deviceFacts();
    const mediaSupported = supportsProfile(load.profile) === true;
    context.sendCustomMessage(namespace, undefined, {
      type: 'output.receipt',
      revision: load.revision,
      playbackConfirmed,
      dolbyVisionOutput:
        playbackConfirmed &&
        mediaSupported &&
        load.profile.dolbyVision === true &&
        facts.dolbyVision === true &&
        activeDolbyVisionConfirmed(),
      dolbyAtmosOutput:
        playbackConfirmed &&
        mediaSupported &&
        load.profile.dolbyAtmos === true &&
        facts.dolbyAtmos === true &&
        activeAtmosTrackConfirmed(),
      detail,
    });
  }

  context.addCustomMessageListener(namespace, (event) => {
    let payload = event.data;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (_) {
        return;
      }
    }
    if (!payload) return;
    if (payload.type === 'state.request') {
      sendSessionState(event.senderId);
      return;
    }
    if (payload.type !== 'capabilities.request') return;
    const revision = Number(payload.revision);
    if (!Number.isSafeInteger(revision)) return;
    sendCapabilities(event.senderId, revision, payload.profile);
  });

  player.addEventListener(
    cast.framework.events.EventType.PLAYING,
    () => sendOutputReceipt(true, 'Receiver PLAYING；等待/校验实际 HDR 与音轨状态'),
  );
  player.addEventListener(
    cast.framework.events.EventType.MEDIA_STATUS,
    (event) => {
      latestMediaStatus = event.mediaStatus || null;
      const playing =
        latestMediaStatus &&
        latestMediaStatus.playerState === cast.framework.messages.PlayerState.PLAYING;
      sendOutputReceipt(Boolean(playing), 'Receiver MediaStatus 实际 HDR/音轨回执');
      sendSessionState(undefined);
    },
  );
  player.addEventListener(
    cast.framework.events.EventType.ERROR,
    () => sendOutputReceipt(false, 'Receiver 报告播放错误'),
  );

  context.start();
})();
