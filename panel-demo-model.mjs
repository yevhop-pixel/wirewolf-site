const SOURCES = ["Laptop", "Room PC", "None"]
const TARGETS = ["a", "b", "audio"]

export function createInitialState(nextRequestId = 1) {
  return {
    power: "on",
    routes: { a: "Laptop", b: "Room PC", audio: "Laptop" },
    volume: 35,
    muted: false,
    offline: false,
    pending: {},
    nextRequestId
  }
}

export function reduceDemo(state, action) {
  switch (action.type) {
    case "route": {
      const { target, source } = action
      if (!TARGETS.includes(target) || !SOURCES.includes(source) ||
          state.power !== "on" || state.pending.power || state.pending[target] ||
          (target === "b" && state.offline) || state.routes[target] === source) return state
      return {
        ...state,
        pending: { ...state.pending, [target]: { id: state.nextRequestId, source } },
        nextRequestId: state.nextRequestId + 1
      }
    }
    case "power": {
      if (state.pending.power || !["on", "off"].includes(action.power) ||
          action.power === state.power) return state
      return {
        ...state,
        pending: { power: { id: state.nextRequestId, power: action.power } },
        nextRequestId: state.nextRequestId + 1
      }
    }
    case "complete": {
      const request = state.pending[action.target]
      if (!request || request.id !== action.id) return state
      if (action.target === "power") {
        if (request.power === "on") {
          const initial = createInitialState(state.nextRequestId)
          return { ...initial, offline: state.offline,
            routes: { ...initial.routes, b: state.offline ? "None" : initial.routes.b } }
        }
        return { ...state, power: "off", routes: { a: "None", b: "None", audio: "None" },
          muted: true, pending: {} }
      }
      const pending = { ...state.pending }
      delete pending[action.target]
      return { ...state, pending, routes: { ...state.routes, [action.target]: request.source } }
    }
    case "offline": {
      if (typeof action.offline !== "boolean" || action.offline === state.offline) return state
      const pending = { ...state.pending }
      if (action.offline) delete pending.b
      return { ...state, offline: action.offline, pending }
    }
    case "volume":
      if (state.power !== "on" || state.pending.power || state.pending.audio ||
          typeof action.volume !== "number" || !Number.isFinite(action.volume)) return state
      return { ...state, volume: Math.max(0, Math.min(100, Math.round(action.volume))) }
    case "mute":
      if (state.power !== "on" || state.pending.power || state.pending.audio) return state
      return { ...state, muted: !state.muted }
    case "reset":
      return createInitialState(state.nextRequestId)
    default:
      return state
  }
}
