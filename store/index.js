(function initializeCoeurGoStore(global) {
  "use strict";

  const state = {
    aeds: [],
    aedById: new Map(),
    verifiedIds: new Set(),
    validationDetails: new Map(),
    photoNames: Object.create(null),
    score: 0,
    missionStep: 0,
    currentAEDId: null,
    pendingPhotoAEDId: null,
    playerPos: null,
    playerAccuracyMeters: null,
    playerMarker: null,
    playerAccuracyCircle: null,
    guidanceLine: null,
    guidanceRouteKey: "",
    guidanceRouteDistanceMeters: null,
    guidanceRouteDurationMinutes: null,
    gpsWatchId: null,
    statusTimer: null,
    flashTimer: null,
    trophyUnlockTimer: null,
    layoutFrame: 0,
    markerRefreshFrame: 0,
    routeAbortController: null,
    routeRequestToken: 0,
    pendingCustomDaeLocation: null,
    markerLayers: new Map(),
    routeCache: new Map(),
    daeAiTrainingSet: [],
    daeAiCentroidVector: [],
    daeAiThresholds: { confirm: 0.73, unsure: 0.62 },
    daeAiReadyPromise: null,
    assistantLogEntries: [],
    assistantLastInteractionAt: Date.now(),
    assistantLastIdleSignature: "",
    assistantCurrentSignature: "",
    assistantPromptTimer: null,
    lastStatusMessage: "",
    lastStatusType: "info"
  };

  const listeners = new Set();

  function notify() {
    listeners.forEach(listener => {
      listener(state);
    });
  }

  function getState() {
    return state;
  }

  function setState(partial) {
    if (!partial || typeof partial !== "object") {
      return state;
    }
    Object.assign(state, partial);
    notify();
    return state;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return function noop() {};
    }
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function bindStateAccess(target, keys) {
    keys.forEach(key => {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: false,
        get() {
          return state[key];
        },
        set(value) {
          setState({ [key]: value });
        }
      });
    });
  }

  global.CoeurGoStore = Object.freeze({
    bindStateAccess,
    getState,
    setState,
    subscribe
  });
})(window);
