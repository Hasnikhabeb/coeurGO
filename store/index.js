(function initializeCoeurGoStore(global) {
  "use strict";

  const state = {
    aeds: [],
    nationalPreviewAeds: [],
    aedById: new Map(),
    verifiedIds: new Set(),
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
  const stateFilters = new Set();

  function notify() {
    listeners.forEach(listener => {
      listener(state);
    });
  }

  function getState() {
    return state;
  }

  function applyStateFilters(partial) {
    let nextPartial = partial;
    stateFilters.forEach(filterFn => {
      const maybeFiltered = filterFn(nextPartial, state);
      if (maybeFiltered && typeof maybeFiltered === "object") {
        nextPartial = maybeFiltered;
      }
    });
    return nextPartial;
  }

  function setState(partial) {
    if (!partial || typeof partial !== "object") {
      return state;
    }
    const filteredPartial = applyStateFilters(partial);
    Object.assign(state, filteredPartial);
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

  function registerStateFilter(filterFn) {
    if (typeof filterFn !== "function") {
      return function noop() {};
    }
    stateFilters.add(filterFn);
    return function unregisterStateFilter() {
      stateFilters.delete(filterFn);
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
    subscribe,
    registerStateFilter
  });
})(window);
